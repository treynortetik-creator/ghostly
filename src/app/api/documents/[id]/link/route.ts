/**
 * The Counting House - Document Link API
 *
 * PUT /api/documents/:id/link - Re-link a document to a different event/expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit, getActor } from '@/lib/audit';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = requirePermission(request, 'write');
    if (denied) return denied;

    const { id } = await params;
    const body = await request.json();

    const eventId = body.event_id ?? null;
    const expenseId = body.expense_id ?? null;

    // Validate XOR constraint
    if (eventId && expenseId) {
      return NextResponse.json(
        { error: 'Cannot link document to both an event and an expense.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check document exists
    const { data: existing, error: findError } = await supabase
      .from('documents')
      .select('id, event_id, expense_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Validate event_id if provided
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

    // Validate expense_id if provided
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

    // Update the link
    const { data: updated, error: updateError } = await supabase
      .from('documents')
      .update({
        event_id: eventId,
        expense_id: expenseId,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      throw updateError || new Error('Failed to update document link');
    }

    // Audit log
    try {
      const { actor, actor_type } = await getActor(request);
      logAudit({
        entity_type: 'document',
        entity_id: id,
        action: 'update',
        changes: {
          event_id: { old: existing.event_id, new: eventId },
          expense_id: { old: existing.expense_id, new: expenseId },
        },
        actor,
        actor_type,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Link document error:', err);
    logError('Failed to link document', { error: err as Error, source: 'api/documents/[id]/link', context: { method: 'PUT' } });
    return NextResponse.json(
      { error: 'Failed to link document' },
      { status: 500 }
    );
  }
}
