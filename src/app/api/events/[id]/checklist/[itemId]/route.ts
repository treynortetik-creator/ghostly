/**
 * The Firm - Event Checklist Item by ID
 *
 * PUT /api/events/:id/checklist/:itemId - Update item (toggle complete, reassign, etc.)
 * DELETE /api/events/:id/checklist/:itemId - Remove item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const denied = requirePermission(request, 'write');
    if (denied) return denied;

    const { id: eventId, itemId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.phase !== undefined) updates.phase = body.phase;
    if (body.assignee_id !== undefined) updates.assignee_id = body.assignee_id || null;
    if (body.due_date !== undefined) updates.due_date = body.due_date || null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    // Handle completion toggle
    if (body.completed !== undefined) {
      if (body.completed) {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = body.completed_by || null;
      } else {
        updates.completed_at = null;
        updates.completed_by = null;
      }
    }

    const { data, error } = await supabase
      .from('event_checklist_items')
      .update(updates)
      .eq('id', itemId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Update checklist item error:', err);
    logError('Failed to update checklist item', { error: err as Error, source: 'api/events/[id]/checklist/[itemId]', context: { method: 'PUT' } });
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const denied = requirePermission(request, 'write');
    if (denied) return denied;

    const { id: eventId, itemId } = await context.params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('event_checklist_items')
      .delete()
      .eq('id', itemId)
      .eq('event_id', eventId);

    if (error) throw error;

    return NextResponse.json({ message: 'Checklist item deleted' });
  } catch (err) {
    console.error('Delete checklist item error:', err);
    logError('Failed to delete checklist item', { error: err as Error, source: 'api/events/[id]/checklist/[itemId]', context: { method: 'DELETE' } });
    return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
  }
}
