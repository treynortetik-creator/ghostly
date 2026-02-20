/**
 * Event Reminder by ID
 *
 * PATCH /api/events/:id/reminders/:rid - Update reminder status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string; rid: string }> };

const validStatuses = ['pending', 'sent', 'dismissed', 'snoozed'];

export const PATCH = withApiHandler({ permission: 'write', resource: 'events/reminders' },
  async (request: NextRequest, context: RouteContext) => {
    const { id: eventId, rid } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'status must be pending, sent, dismissed, or snoozed' }, { status: 400 });
      }
      updates.status = body.status;
      if (body.status === 'sent') {
        updates.sent_at = new Date().toISOString();
      }
    }

    if (body.reminder_date !== undefined) updates.reminder_date = body.reminder_date;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;

    const { data, error } = await supabase
      .from('event_reminders')
      .update(updates)
      .eq('id', rid)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);
