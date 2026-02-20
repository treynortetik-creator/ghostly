/**
 * Mark Reminder as Sent (Scrooge endpoint)
 *
 * PATCH /api/reminders/:rid/sent - Scrooge marks a reminder as sent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ rid: string }> };

export const PATCH = withApiHandler({ permission: 'write', resource: 'reminders/[rid]/sent' },
  async (request: NextRequest, context: RouteContext) => {
    const { rid } = await context.params;
    const supabase = await createClient();

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
