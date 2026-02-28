/**
 * Ghostly - Data Retention & Cleanup API
 *
 * POST /api/admin/cleanup - Run maintenance tasks (admin only)
 *
 * Cleans up:
 * - error_logs older than 30 days
 * - expired idempotency_keys
 * - orphaned files from soft-deleted documents (deleted > 7 days ago)
 * - expired rate_limit_entries (older than 1 hour)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import { cleanupRateLimitEntries } from '@/lib/rate-limiter';
import path from 'path';
import fs from 'fs/promises';

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';
const MAX_BATCH_SIZE = 500;
const DEFAULT_BATCH_SIZE = 100;

function getUploadBasePath(): string {
  if (path.isAbsolute(UPLOAD_DIR)) {
    return UPLOAD_DIR;
  }
  return path.join(process.cwd(), UPLOAD_DIR);
}

export const POST = withApiHandler({ permission: 'admin', resource: 'admin/cleanup' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    // Parse optional batch_size from request body
    let batchSize = DEFAULT_BATCH_SIZE;
    try {
      const body = await request.json();
      if (body.batch_size !== undefined) {
        const parsed = Number(body.batch_size);
        if (!Number.isInteger(parsed) || parsed < 1) {
          return NextResponse.json(
            { error: 'batch_size must be a positive integer' },
            { status: 400 }
          );
        }
        if (parsed > MAX_BATCH_SIZE) {
          return NextResponse.json(
            { error: `batch_size must not exceed ${MAX_BATCH_SIZE}` },
            { status: 400 }
          );
        }
        batchSize = parsed;
      }
    } catch {
      // No body or invalid JSON — use default batch size
    }

    const results: Record<string, { deleted: number; errors?: string[] }> = {};

    const supabase = await createClient();
    const now = new Date();

    // 1. Clean old error_logs (> 30 days), limited to batch size
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // First select IDs to delete (limited), then delete by those IDs
    const { data: errorLogIds, error: elSelErr } = await supabase
      .from('error_logs')
      .select('id')
      .lt('created_at', thirtyDaysAgo)
      .limit(batchSize);

    let errorLogsDeleted = 0;
    let elErr = elSelErr;
    if (!elSelErr && errorLogIds && errorLogIds.length > 0) {
      const ids = errorLogIds.map((r: { id: string }) => r.id);
      const { count, error } = await supabase
        .from('error_logs')
        .delete({ count: 'exact' })
        .in('id', ids);
      errorLogsDeleted = count ?? 0;
      elErr = error;
    }

    results.error_logs = { deleted: errorLogsDeleted };
    if (elErr) results.error_logs.errors = [elErr.message];

    // 2. Clean expired idempotency_keys, limited to batch size
    const { data: idempKeyIds, error: ikSelErr } = await supabase
      .from('idempotency_keys')
      .select('id')
      .lt('expires_at', now.toISOString())
      .limit(batchSize);

    let idempKeysDeleted = 0;
    let ikErr = ikSelErr;
    if (!ikSelErr && idempKeyIds && idempKeyIds.length > 0) {
      const ids = idempKeyIds.map((r: { id: string }) => r.id);
      const { count, error } = await supabase
        .from('idempotency_keys')
        .delete({ count: 'exact' })
        .in('id', ids);
      idempKeysDeleted = count ?? 0;
      ikErr = error;
    }

    results.idempotency_keys = { deleted: idempKeysDeleted };
    if (ikErr) results.idempotency_keys.errors = [ikErr.message];

    // 3. Clean orphaned files from documents soft-deleted > 7 days ago (scoped to org)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orphanedDocs, error: odErr } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('organization_id', orgId)
      .not('deleted_at', 'is', null)
      .lt('deleted_at', sevenDaysAgo)
      .limit(batchSize);

    let filesDeleted = 0;
    const fileErrors: string[] = [];

    if (!odErr && orphanedDocs && orphanedDocs.length > 0) {
      const basePath = getUploadBasePath();

      for (const doc of orphanedDocs) {
        const relativePath = doc.storage_path.replace(/^uploads\//, '');
        const filePath = path.join(basePath, relativePath);

        // Security: ensure path is within uploads
        const resolvedPath = path.resolve(filePath);
        const resolvedBase = path.resolve(basePath);
        if (!resolvedPath.startsWith(resolvedBase)) {
          fileErrors.push(`Skipped unsafe path: ${doc.id}`);
          continue;
        }

        try {
          await fs.unlink(filePath);
          filesDeleted++;
        } catch {
          // File may already be gone — that's fine
        }
      }

      // Hard-delete the document records now that files are cleaned (only the batch we selected)
      const docIds = orphanedDocs.map((d: { id: string }) => d.id);
      await supabase
        .from('documents')
        .delete()
        .in('id', docIds);
    }

    results.orphaned_files = { deleted: filesDeleted };
    if (odErr) results.orphaned_files.errors = [odErr.message];
    if (fileErrors.length > 0) {
      results.orphaned_files.errors = [
        ...(results.orphaned_files.errors || []),
        ...fileErrors,
      ];
    }

    // 4. Clean expired rate_limit_entries (older than 1 hour)
    try {
      const rateLimitDeleted = await cleanupRateLimitEntries();
      results.rate_limit_entries = { deleted: rateLimitDeleted };
    } catch (rlErr) {
      results.rate_limit_entries = { deleted: 0, errors: [(rlErr as Error).message] };
    }

    // Audit log
    await auditMutation(request, {
      entity_type: 'document',
      entity_id: 'cleanup',
      action: 'delete',
      changes: null,
      metadata: results,
    });

    return NextResponse.json({
      success: true,
      cleanup: results,
      batch_size: batchSize,
      ran_at: now.toISOString(),
    });
  }
);
