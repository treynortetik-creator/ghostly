/**
 * The Counting House - Document Download API
 *
 * GET /api/documents/:id/download - Download the actual file
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';
import path from 'path';
import fs from 'fs/promises';

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';

function getUploadBasePath(): string {
  if (path.isAbsolute(UPLOAD_DIR)) {
    return UPLOAD_DIR;
  }
  return path.join(process.cwd(), UPLOAD_DIR);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = requirePermission(request, 'read');
    if (denied) return denied;

    const { id } = await params;
    const supabase = await createClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Construct file path from storage_path
    // storage_path is like: uploads/2026/02/{uuid}.pdf
    // We need to strip the leading "uploads/" since getUploadBasePath already points to the uploads dir
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

    // Check file exists
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      );
    }

    // Read file and stream it back
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': doc.mime_type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.original_filename)}"`,
        'Content-Length': doc.file_size_bytes.toString(),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Download document error:', err);
    logError('Failed to download document', { error: err as Error, source: 'api/documents/[id]/download', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
