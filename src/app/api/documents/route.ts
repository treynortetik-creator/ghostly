/**
 * Ghostly - Documents API
 *
 * Endpoints:
 * GET /api/documents - List documents with optional filters
 * POST /api/documents - Upload a new document (multipart form)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit, getActor } from '@/lib/audit';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { parsePagination, paginationMeta, paginationRange } from '@/lib/pagination';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from '@/lib/constants';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';

const MAX_DOCS_PER_EVENT = 50;
const MAX_DOCS_PER_EXPENSE = 10;

// Simple in-memory rate limiter for uploads (per IP, 20 uploads per minute)
const UPLOAD_RATE_LIMIT = 20;
const UPLOAD_RATE_WINDOW_MS = 60_000;
const uploadRateMap = new Map<string, { count: number; resetAt: number }>();

function isUploadRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = uploadRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    uploadRateMap.set(ip, { count: 1, resetAt: now + UPLOAD_RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > UPLOAD_RATE_LIMIT;
}

// Magic bytes for file type verification
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
const DOCX_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04 (ZIP/DOCX)

function verifyMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 4) return false;
  const header = new Uint8Array(buffer.slice(0, 4));
  if (ext === '.pdf') {
    return header.every((b, i) => b === PDF_MAGIC[i]);
  }
  if (ext === '.docx') {
    return header.every((b, i) => b === DOCX_MAGIC[i]);
  }
  return false;
}

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

/* eslint-disable @typescript-eslint/no-explicit-any */
export const GET = withApiHandler({ permission: 'read', resource: 'documents' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const eventId = searchParams.get('event_id');
    const expenseId = searchParams.get('expense_id');
    const unlinked = searchParams.get('unlinked') === 'true';
    const modifiedAfter = searchParams.get('modified_after');
    const pagination = parsePagination(searchParams, 20, 100);
    const { from, to } = paginationRange(pagination);

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
      .eq('organization_id', orgId)
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
      pagination: paginationMeta(total, pagination),
    });
  }
);

// ============================================
// POST /api/documents
// ============================================

export const POST = withApiHandler({ permission: 'write', resource: 'documents' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    // Rate limit uploads
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isUploadRateLimited(clientIp)) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429 },
      );
    }

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
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}` },
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

    // Validate event_id exists if provided + check document count limit
    if (eventId) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .single();

      if (eventError || !event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }

      const { count: docCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('deleted_at', null);

      if ((docCount ?? 0) >= MAX_DOCS_PER_EVENT) {
        return NextResponse.json(
          { error: `Maximum of ${MAX_DOCS_PER_EVENT} documents per event reached.` },
          { status: 400 },
        );
      }
    }

    // Validate expense_id exists if provided + check document count limit
    if (expenseId) {
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .select('id')
        .eq('id', expenseId)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .single();

      if (expenseError || !expense) {
        return NextResponse.json(
          { error: 'Expense not found' },
          { status: 404 }
        );
      }

      const { count: docCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('expense_id', expenseId)
        .is('deleted_at', null);

      if ((docCount ?? 0) >= MAX_DOCS_PER_EXPENSE) {
        return NextResponse.json(
          { error: `Maximum of ${MAX_DOCS_PER_EXPENSE} documents per expense reached.` },
          { status: 400 },
        );
      }
    }

    // Generate storage path
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const docId = randomUUID();
    const storagePath = `uploads/${year}/${month}/${docId}${ext}`;

    // Read file bytes and verify magic bytes match claimed type
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!verifyMagicBytes(buffer, ext)) {
      return NextResponse.json(
        { error: 'File content does not match its extension. The file may be corrupted or misnamed.' },
        { status: 400 },
      );
    }

    // Write file to disk
    const absolutePath = path.join(getUploadBasePath(), year, month);
    await fs.mkdir(absolutePath, { recursive: true });
    await fs.writeFile(path.join(absolutePath, `${docId}${ext}`), buffer);

    // Determine source and uploaded_by
    const { actor, actor_type } = await getActor(request);
    const source = actor_type === 'agent' ? 'api' : 'upload';
    const uploadedBy = actor_type === 'agent' ? actor : 'user';

    // Insert document record
    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        organization_id: orgId,
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
  }
);
