/**
 * Ghostly - Event Checklist Item by ID
 *
 * PUT /api/events/:id/checklist/:itemId - Update item (toggle complete, reassign, etc.)
 * DELETE /api/events/:id/checklist/:itemId - Remove item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export const PUT = withApiHandler({ permission: 'write', resource: 'events/checklist' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId, itemId } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    // Verify event belongs to org
    const { data: event } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

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
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'events/checklist' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId, itemId } = await context.params;
    const supabase = createClient();

    // Verify event belongs to org
    const { data: event } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { error } = await supabase
      .from('event_checklist_items')
      .delete()
      .eq('id', itemId)
      .eq('event_id', eventId);

    if (error) throw error;

    return NextResponse.json({ message: 'Checklist item deleted' });
  }
);
