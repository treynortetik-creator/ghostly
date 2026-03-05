/**
 * Generate Event Reminders
 *
 * POST /api/events/:id/reminders/generate - Generate reminders from cadence template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withApiHandler({ permission: 'write', resource: 'events/reminders' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const supabase = createClient();

    // Fetch event with date_start (scoped to org)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, date_start, event_type_id')
      .eq('id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.date_start) {
      return NextResponse.json({ error: 'Event must have a start date to generate reminders' }, { status: 400 });
    }

    // Determine which template to use
    let templateId = body.template_id;

    if (!templateId) {
      // Find default template for this event's type
      if (!event.event_type_id) {
        return NextResponse.json({ error: 'Event has no type assigned. Provide a template_id explicitly.' }, { status: 400 });
      }

      const { data: defaultTemplate } = await supabase
        .from('cadence_templates')
        .select('id')
        .eq('organization_id', orgId)
        .eq('event_type_id', event.event_type_id)
        .eq('is_default', true)
        .limit(1)
        .single();

      if (!defaultTemplate) {
        // Fall back to any template for this event type
        const { data: anyTemplate } = await supabase
          .from('cadence_templates')
          .select('id')
          .eq('organization_id', orgId)
          .eq('event_type_id', event.event_type_id)
          .limit(1)
          .single();

        if (!anyTemplate) {
          return NextResponse.json({ error: 'No cadence template found for this event type. Provide a template_id explicitly.' }, { status: 400 });
        }
        templateId = anyTemplate.id;
      } else {
        templateId = defaultTemplate.id;
      }
    }

    // Fetch milestones for the template
    const { data: milestones, error: milestoneError } = await supabase
      .from('cadence_milestones')
      .select('*')
      .eq('template_id', templateId)
      .order('display_order', { ascending: true });

    if (milestoneError) throw milestoneError;

    if (!milestones || milestones.length === 0) {
      return NextResponse.json({ error: 'Template has no milestones' }, { status: 400 });
    }

    // Delete existing reminders for this event (regenerate from scratch)
    await supabase
      .from('event_reminders')
      .delete()
      .eq('event_id', eventId);

    // Compute reminder dates and create rows
    const startDate = new Date(event.date_start + 'T00:00:00');
    const reminders = milestones.map(m => {
      const reminderDate = new Date(startDate);
      reminderDate.setDate(reminderDate.getDate() + m.offset_days);
      const dateStr = reminderDate.toISOString().split('T')[0];

      return {
        event_id: eventId,
        organization_id: orgId,
        milestone_id: m.id,
        reminder_date: dateStr,
        title: m.title,
        description: m.description,
        status: 'pending' as const,
      };
    });

    const { data: created, error: insertError } = await supabase
      .from('event_reminders')
      .insert(reminders)
      .select();

    if (insertError) throw insertError;

    return NextResponse.json({
      reminders: created || [],
      meta: {
        total: (created || []).length,
        template_id: templateId,
        event_start_date: event.date_start,
      },
    }, { status: 201 });
  }
);
