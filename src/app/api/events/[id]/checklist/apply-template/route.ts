/**
 * The Firm - Apply Checklist Template to Event
 *
 * POST /api/events/:id/checklist/apply-template - Apply a template's items to this event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: eventId } = await context.params;
    const body = await request.json();

    if (!body.template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the template items
    const { data: templateItems, error: templateError } = await supabase
      .from('checklist_template_items')
      .select('*')
      .eq('template_id', body.template_id)
      .order('phase', { ascending: true })
      .order('sort_order', { ascending: true });

    if (templateError) throw templateError;

    if (!templateItems || templateItems.length === 0) {
      return NextResponse.json({ error: 'Template has no items' }, { status: 400 });
    }

    // Fetch existing checklist items for this event to avoid duplicates
    const { data: existingItems } = await supabase
      .from('event_checklist_items')
      .select('template_item_id')
      .eq('event_id', eventId)
      .not('template_item_id', 'is', null);

    const existingTemplateItemIds = new Set(
      (existingItems || []).map(i => i.template_item_id).filter(Boolean)
    );

    // Fetch event to get date_start for computing due dates
    const { data: event } = await supabase
      .from('events')
      .select('date_start')
      .eq('id', eventId)
      .single();

    const eventStart = event?.date_start ? new Date(event.date_start) : null;

    // Create new checklist items from template (skip duplicates)
    const newItems = templateItems
      .filter(ti => !existingTemplateItemIds.has(ti.id))
      .map(ti => {
        let dueDate: string | null = null;
        if (eventStart && ti.days_offset != null) {
          const d = new Date(eventStart);
          d.setDate(d.getDate() + ti.days_offset);
          dueDate = d.toISOString().split('T')[0];
        }

        return {
          event_id: eventId,
          template_item_id: ti.id,
          title: ti.title,
          description: ti.description,
          phase: ti.phase,
          due_date: dueDate,
          sort_order: ti.sort_order,
        };
      });

    if (newItems.length === 0) {
      return NextResponse.json({
        message: 'Template already applied — no new items to add',
        items_added: 0,
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('event_checklist_items')
      .insert(newItems)
      .select();

    if (insertError) throw insertError;

    return NextResponse.json({
      message: `Applied ${(inserted || []).length} items from template`,
      items_added: (inserted || []).length,
      items: inserted,
    }, { status: 201 });
  } catch (err) {
    console.error('Apply template error:', err);
    logError('Failed to apply template', { error: err as Error, source: 'api/events/[id]/checklist/apply-template', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 });
  }
}
