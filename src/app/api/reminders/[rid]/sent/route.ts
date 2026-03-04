/**
 * Mark Reminder as Sent (AI agent endpoint)
 *
 * PATCH /api/reminders/:rid/sent - AI agent marks a reminder as sent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ rid: string }> };

export const PATCH = withApiHandler({ permission: 'write', resource: 'reminders/[rid]/sent' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { rid } = await context.params;
    const supabase = createClient();

    // First verify the reminder belongs to an event in this org
    const { data: reminder } = await supabase
      .from('event_reminders')
      .select('event_id')
      .eq('id', rid)
      .single();

    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found or already sent' }, { status: 404 });
    }

    const { data: eventCheck } = await supabase
      .from('events')
      .select('id')
      .eq('id', reminder.event_id)
      .eq('organization_id', orgId)
      .single();

    if (!eventCheck) {
      return NextResponse.json({ error: 'Reminder not found or already sent' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('event_reminders')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', rid)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Reminder not found or already sent' }, { status: 404 });
    }

    // Audit log
    await auditMutation(request, {
      entity_type: 'reminder',
      entity_id: rid,
      action: 'send',
      changes: null,
      metadata: { event_id: data.event_id },
    });

    return NextResponse.json(data);
  }
);
