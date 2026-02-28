/**
 * Ghostly - Data Retention & Cleanup API
 *
 * POST /api/admin/cleanup - Run maintenance tasks (admin only)
 *
 * Cleans up:
 * - error_logs older than 30 days
 * - expired idempotency_keys
 * - orphaned files from soft-deleted documents (deleted > 7 days ago)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';
import path from 'path';
import fs from 'fs/promises';

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';

function getUploadBasePath(): string {
  if (path.isAbsolute(UPLOAD_DIR)) {
    return UPLOAD_DIR;
  }
  return path.join(process.cwd(), UPLOAD_DIR);
}

export const POST = withApiHandler({ permission: 'admin', resource: 'admin/cleanup' },
  async (request: NextRequest) => {
    const results: Record<string, { deleted: number; errors?: string[] }> = {};

    const supabase = await createClient();
    const now = new Date();

    // 1. Clean old error_logs (> 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: errorLogsDeleted, error: elErr } = await supabase
      .from('error_logs')
      .delete({ count: 'exact' })
      .lt('created_at', thirtyDaysAgo);

    results.error_logs = { deleted: errorLogsDeleted ?? 0 };
    if (elErr) results.error_logs.errors = [elErr.message];

    // 2. Clean expired idempotency_keys
    const { count: idempKeysDeleted, error: ikErr } = await supabase
      .from('idempotency_keys')
      .delete({ count: 'exact' })
      .lt('expires_at', now.toISOString());

    results.idempotency_keys = { deleted: idempKeysDeleted ?? 0 };
    if (ikErr) results.idempotency_keys.errors = [ikErr.message];

    // 3. Clean orphaned files from documents soft-deleted > 7 days ago
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orphanedDocs, error: odErr } = await supabase
      .from('documents')
      .select('id, storage_path')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', sevenDaysAgo);

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

      // Hard-delete the document records now that files are cleaned
      await supabase
        .from('documents')
        .delete()
        .not('deleted_at', 'is', null)
        .lt('deleted_at', sevenDaysAgo);
    }

    results.orphaned_files = { deleted: filesDeleted };
    if (odErr) results.orphaned_files.errors = [odErr.message];
    if (fileErrors.length > 0) {
      results.orphaned_files.errors = [
        ...(results.orphaned_files.errors || []),
        ...fileErrors,
      ];
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
      ran_at: now.toISOString(),
    });
  }
);
