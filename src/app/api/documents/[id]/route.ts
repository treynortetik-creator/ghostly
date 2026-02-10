/**
 * The Counting House - Single Document API
 *
 * Endpoints:
 * GET /api/documents/:id - Get document metadata
 * DELETE /api/documents/:id - Soft-delete a document
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit, getActor } from '@/lib/audit';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================
// GET /api/documents/:id
// ============================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = requirePermission(request, 'read');
    if (denied) return denied;

    const { id } = await params;
    const supabase = await createClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('*, events(name), expenses(vendor)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const { events: eventRel, expenses: expenseRel, ...rest } = doc as any;
    return NextResponse.json({
      ...rest,
      event_name: eventRel?.name || null,
      expense_vendor: expenseRel?.vendor || null,
    });
  } catch (err) {
    console.error('Get document error:', err);
    logError('Failed to get document', { error: err as Error, source: 'api/documents/[id]', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to get document' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/documents/:id
// ============================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = requirePermission(request, 'write');
    if (denied) return denied;

    const { id } = await params;
    const supabase = await createClient();

    // Check document exists
    const { data: existing, error: findError } = await supabase
      .from('documents')
      .select('id, filename')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Soft delete
    const { error: updateError } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Audit log
    try {
      const { actor, actor_type } = await getActor(request);
      logAudit({
        entity_type: 'document',
        entity_id: id,
        action: 'delete',
        changes: null,
        actor,
        actor_type,
        metadata: { filename: existing.filename },
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    return NextResponse.json({
      message: 'Document deleted successfully',
      id,
    });
  } catch (err) {
    console.error('Delete document error:', err);
    logError('Failed to delete document', { error: err as Error, source: 'api/documents/[id]', context: { method: 'DELETE' } });
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
