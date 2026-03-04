/**
 * Ghostly - Document Download API
 *
 * GET /api/documents/:id/download - Download the actual file
 *
 * Downloads from Supabase Storage for new files, falls back to
 * local filesystem for legacy files (storage_path starting with "uploads/").
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import { downloadDocument } from '@/lib/storage';
import { getUploadBasePath } from '@/lib/uploads';
import path from 'path';
import fs from 'fs/promises';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Legacy storage paths start with "uploads/" and point to the local filesystem.
 * New paths use the Supabase Storage format: "{orgId}/{docId}/{filename}".
 */
function isLegacyPath(storagePath: string): boolean {
  return storagePath.startsWith('uploads/');
}

export const GET = withApiHandler({ permission: 'read', resource: 'documents' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    let fileBlob: Blob;

    if (isLegacyPath(doc.storage_path)) {
      // Legacy: local filesystem
      const relativePath = doc.storage_path.replace(/^uploads\//, '');
      const filePath = path.join(getUploadBasePath(), relativePath);

      // Security: ensure the resolved path is within the upload directory
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(getUploadBasePath());
      if (!resolvedPath.startsWith(resolvedBase)) {
        return NextResponse.json(
          { error: 'Invalid file path' },
          { status: 400 }
        );
      }

      try {
        const buf = await fs.readFile(filePath);
        fileBlob = new Blob([buf], { type: doc.mime_type });
      } catch {
        return NextResponse.json(
          { error: 'File not found on disk' },
          { status: 404 }
        );
      }
    } else {
      // New: Supabase Storage
      try {
        fileBlob = await downloadDocument(doc.storage_path);
      } catch (err) {
        console.error('Supabase Storage download failed:', err);
        return NextResponse.json(
          { error: 'File not found in storage' },
          { status: 404 }
        );
      }
    }

    // Audit log the download
    await auditMutation(request, {
      entity_type: 'document',
      entity_id: id,
      action: 'download',
      changes: null,
      metadata: { filename: doc.original_filename },
    });

    return new NextResponse(fileBlob, {
      status: 200,
      headers: {
        'Content-Type': doc.mime_type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.original_filename)}"`,
        'Content-Length': doc.file_size_bytes.toString(),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }
);
