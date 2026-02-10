/**
 * The Counting House - Documents API
 *
 * Endpoints:
 * GET /api/documents - List documents with optional filters
 * POST /api/documents - Upload a new document (multipart form)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit, getActor } from '@/lib/audit';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

const MAX_FILE_SIZE = (parseInt(process.env.DOCUMENT_MAX_SIZE_MB || '10', 10)) * 1024 * 1024;

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';

/**
 * Get the absolute upload directory path
 */
function getUploadBasePath(): string {
  if (path.isAbsolute(UPLOAD_DIR)) {
    return UPLOAD_DIR;
  }
  return path.join(process.cwd(), UPLOAD_DIR);
}

/**
 * Sanitize a filename for display (remove path components, limit length)
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let clean = filename.replace(/[/\\:\0]/g, '_');
  // Limit length
  if (clean.length > 200) {
    const ext = path.extname(clean);
    clean = clean.substring(0, 200 - ext.length) + ext;
  }
  return clean;
}

// ============================================
// GET /api/documents
// ============================================

export async function GET(request: NextRequest) {
  try {
    const denied = requirePermission(request, 'read');
    if (denied) return denied;

    const { searchParams } = new URL(request.url);

    const eventId = searchParams.get('event_id');
    const expenseId = searchParams.get('expense_id');
    const unlinked = searchParams.get('unlinked') === 'true';
    const modifiedAfter = searchParams.get('modified_after');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '20', 10)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // Validate modified_after if provided
    if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from('documents')
      .select('*, events(name), expenses(vendor)', { count: 'exact' })
      .is('deleted_at', null);

    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    if (expenseId) {
      query = query.eq('expense_id', expenseId);
    }
    if (unlinked) {
      query = query.is('event_id', null).is('expense_id', null);
    }
    if (modifiedAfter) {
      query = query.gt('updated_at', modifiedAfter);
    }

    query = query.order('created_at', { ascending: false });
    query = query.range(from, to);

    const { data: rawDocs, error, count: totalCount } = await query;

    if (error) {
      throw error;
    }

    const documents = (rawDocs || []).map((doc: any) => {
      const { events: eventRel, expenses: expenseRel, ...rest } = doc;
      return {
        ...rest,
        event_name: eventRel?.name || null,
        expense_vendor: expenseRel?.vendor || null,
      };
    });

    const total = totalCount ?? documents.length;

    return NextResponse.json({
      documents,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    console.error('Documents API error:', err);
    logError('Failed to fetch documents', { error: err as Error, source: 'api/documents', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/documents
// ============================================

export async function POST(request: NextRequest) {
  try {
    const denied = requirePermission(request, 'write');
    if (denied) return denied;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('event_id') as string | null;
    const expenseId = formData.get('expense_id') as string | null;

    // Validate file is present
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${process.env.DOCUMENT_MAX_SIZE_MB || '10'} MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and DOCX files are allowed.' },
        { status: 400 }
      );
    }

    // Validate XOR constraint
    if (eventId && expenseId) {
      return NextResponse.json(
        { error: 'Cannot link document to both an event and an expense.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Validate event_id exists if provided
    if (eventId) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .is('deleted_at', null)
        .single();

      if (eventError || !event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }
    }

    // Validate expense_id exists if provided
    if (expenseId) {
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .select('id')
        .eq('id', expenseId)
        .is('deleted_at', null)
        .single();

      if (expenseError || !expense) {
        return NextResponse.json(
          { error: 'Expense not found' },
          { status: 404 }
        );
      }
    }

    // Generate storage path
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const docId = randomUUID();
    const storagePath = `uploads/${year}/${month}/${docId}${ext}`;

    // Write file to disk
    const absolutePath = path.join(getUploadBasePath(), year, month);
    await fs.mkdir(absolutePath, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(absolutePath, `${docId}${ext}`), buffer);

    // Determine source and uploaded_by
    const { actor, actor_type } = await getActor(request);
    const source = actor_type === 'agent' ? 'api' : 'upload';
    const uploadedBy = actor_type === 'agent' ? actor : 'user';

    // Insert document record
    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        filename: sanitizeFilename(file.name),
        original_filename: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        storage_path: storagePath,
        source,
        event_id: eventId || null,
        expense_id: expenseId || null,
        uploaded_by: uploadedBy,
      })
      .select()
      .single();

    if (insertError || !newDoc) {
      // Clean up the file if DB insert fails
      try {
        await fs.unlink(path.join(absolutePath, `${docId}${ext}`));
      } catch { /* ignore cleanup errors */ }
      throw insertError || new Error('Failed to insert document record');
    }

    // Audit log (non-blocking)
    try {
      logAudit({
        entity_type: 'document',
        entity_id: newDoc.id,
        action: 'create',
        changes: null,
        actor,
        actor_type,
        metadata: {
          filename: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          event_id: eventId,
          expense_id: expenseId,
        },
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    return NextResponse.json(newDoc, { status: 201 });
  } catch (err) {
    console.error('Upload document error:', err);
    logError('Failed to upload document', { error: err as Error, source: 'api/documents', context: { method: 'POST' } });
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
