/**
 * Ghostly - Document Link API
 *
 * PUT /api/documents/:id/link - Re-link a document to a different event/expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const PUT = withApiHandler({ permission: 'write', resource: 'documents' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
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

    const supabase = createClient();

    // Check document exists and belongs to org
    const { data: existing, error: findError } = await supabase
      .from('documents')
      .select('id, event_id, expense_id')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Validate event_id if provided (scoped to org)
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
    }

    // Validate expense_id if provided (scoped to org)
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
    await auditMutation(request, {
      entity_type: 'document',
      entity_id: id,
      action: 'update',
      changes: {
        event_id: { old: existing.event_id, new: eventId },
        expense_id: { old: existing.expense_id, new: expenseId },
      },
    });

    return NextResponse.json(updated);
  }
);
