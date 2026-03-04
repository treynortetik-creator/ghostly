/**
 * Agent Tool API - Create Checklist Item
 *
 * POST /api/agent/tools/checklist-item
 * Creates a new checklist item for an event.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const POST = withApiHandler({ permission: 'write', resource: 'agent-tools' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    const { event_id, title, phase, due_date, description } = body;

    if (!event_id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: event_id, title' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Verify the event belongs to this org
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', event_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found or does not belong to this organization' },
        { status: 404 }
      );
    }

    // Get max sort_order for this event's checklist
    const { data: maxOrder } = await supabase
      .from('event_checklist_items')
      .select('sort_order')
      .eq('event_id', event_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

    const { data: newItem, error: insertError } = await supabase
      .from('event_checklist_items')
      .insert({
        event_id,
        title,
        description: description || null,
        phase: phase || 'pre_event',
        due_date: due_date || null,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      checklist_item: newItem,
      event_name: event.name,
      message: `Checklist item "${title}" added to event "${event.name}"`,
    }, { status: 201 });
  }
);
