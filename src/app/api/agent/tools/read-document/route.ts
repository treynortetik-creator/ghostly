/**
 * Agent Tool API - Read Document
 *
 * GET /api/agent/tools/read-document
 * Returns full extracted text content of a document plus metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { extractTextFromFile } from '@/lib/agent/file-processor';

export const GET = withApiHandler({ permission: 'read', resource: 'documents' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('document_id');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: document_id' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, filename, mime_type, storage_path, ai_summary, ai_tags')
      .eq('id', documentId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    let text: string;
    try {
      text = await extractTextFromFile(doc.storage_path, doc.mime_type);
    } catch {
      text = '[Could not extract text from this document]';
    }

    return NextResponse.json({
      filename: doc.filename,
      summary: doc.ai_summary ?? null,
      tags: doc.ai_tags ?? [],
      text,
    });
  }
);
