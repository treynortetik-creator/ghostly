/**
 * Ghostly - Generate Pipeline Tasks from Template
 *
 * POST /api/events/:id/checklist/generate
 *
 * Auto-generates checklist items for an event based on its tier,
 * pulling from the "Event Pipeline Template" checklist template.
 * Deduplicates by template_item_id so it's safe to call repeatedly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';
import { subDays, addDays, parseISO } from 'date-fns';
import type { ChecklistPhase } from '@/types/database';

type RouteContext = { params: Promise<{ id: string }> };

/** Map event tier values to the boolean column name on checklist_template_items */
const TIER_COLUMN_MAP: Record<string, string> = {
  executive: 'tier_executive',
  national_t1: 'tier_national_t1',
  national_t2: 'tier_national_t2',
  state_t1: 'tier_state_t1',
  state_t2: 'tier_state_t2',
  customer_partner: 'tier_customer',
};

const PIPELINE_TEMPLATE_NAME = 'Event Pipeline Template';

export const POST = withApiHandler({ permission: 'write', resource: 'events/checklist' },
  async (request: NextRequest, context: RouteContext) => {
    const { id: eventId } = await context.params;
    const supabase = await createClient();

    // 1. Fetch the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, tier, date_start, date_end')
      .eq('id', eventId)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 2. Validate tier
    if (!event.tier) {
      return NextResponse.json(
        { error: 'Event has no tier set. Assign a tier before generating pipeline tasks.' },
        { status: 400 }
      );
    }

    const tierColumn = TIER_COLUMN_MAP[event.tier];
    if (!tierColumn) {
      return NextResponse.json(
        { error: `Unknown tier value: ${event.tier}` },
        { status: 400 }
      );
    }

    // 3. Find the Event Pipeline Template
    const { data: template, error: templateError } = await supabase
      .from('checklist_templates')
      .select('id')
      .eq('name', PIPELINE_TEMPLATE_NAME)
      .is('deleted_at', null)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: `Template "${PIPELINE_TEMPLATE_NAME}" not found` },
        { status: 404 }
      );
    }

    // 4. Fetch template items matching the event's tier
    const { data: templateItems, error: itemsError } = await supabase
      .from('checklist_template_items')
      .select('*')
      .eq('template_id', template.id)
      .eq(tierColumn, true)
      .order('sort_order', { ascending: true });

    if (itemsError) throw itemsError;

    if (!templateItems || templateItems.length === 0) {
      return NextResponse.json({
        message: 'No template items match this tier',
        items_added: 0,
        items_skipped: 0,
        items: [],
      });
    }

    // 5. Check which template items already exist on this event (dedup)
    const { data: existingItems, error: existingError } = await supabase
      .from('event_checklist_items')
      .select('template_item_id')
      .eq('event_id', eventId)
      .not('template_item_id', 'is', null);

    if (existingError) throw existingError;

    const existingTemplateIds = new Set(
      (existingItems || []).map(i => i.template_item_id)
    );

    const newTemplateItems = templateItems.filter(
      ti => !existingTemplateIds.has(ti.id)
    );
    const itemsSkipped = templateItems.length - newTemplateItems.length;

    if (newTemplateItems.length === 0) {
      return NextResponse.json({
        message: 'All template items already exist on this event',
        items_added: 0,
        items_skipped: itemsSkipped,
        items: [],
      });
    }

    // 6. Calculate due dates and build insert rows
    const dateStart = event.date_start ? parseISO(event.date_start) : null;
    const dateEnd = event.date_end ? parseISO(event.date_end) : null;

    const insertRows = newTemplateItems.map(ti => {
      let dueDate: string | null = null;

      if (ti.days_offset !== null && ti.days_offset !== undefined) {
        if (ti.days_offset > 0) {
          // Positive offset = pre-event: date_start - days_offset
          if (dateStart) {
            dueDate = subDays(dateStart, ti.days_offset).toISOString().split('T')[0];
          }
        } else if (ti.days_offset < 0) {
          // Negative offset = post-event: date_end + abs(days_offset), fallback to date_start
          const baseDate = dateEnd || dateStart;
          if (baseDate) {
            dueDate = addDays(baseDate, Math.abs(ti.days_offset)).toISOString().split('T')[0];
          }
        } else {
          // days_offset === 0 means day-of, use date_start
          if (dateStart) {
            dueDate = dateStart.toISOString().split('T')[0];
          }
        }
      }

      return {
        event_id: eventId,
        template_item_id: ti.id,
        title: ti.title,
        description: ti.description || null,
        phase: ti.phase as ChecklistPhase,
        due_date: dueDate,
        sort_order: ti.sort_order,
        category: ti.category || null,
      };
    });

    // 7. Insert new checklist items
    const { data: inserted, error: insertError } = await supabase
      .from('event_checklist_items')
      .insert(insertRows)
      .select();

    if (insertError) throw insertError;

    // 8. Audit log (non-blocking)
    await auditMutation(request, {
      entity_type: 'event',
      entity_id: eventId,
      action: 'create',
      changes: null,
      metadata: {
        sub_type: 'pipeline_tasks_generated',
        tier: event.tier,
        items_added: inserted?.length || 0,
        items_skipped: itemsSkipped,
      },
    });

    // 9. Return result
    return NextResponse.json({
      message: `Generated ${inserted?.length || 0} pipeline tasks for ${event.tier} tier`,
      items_added: inserted?.length || 0,
      items_skipped: itemsSkipped,
      items: inserted || [],
    }, { status: 201 });
  }
);
