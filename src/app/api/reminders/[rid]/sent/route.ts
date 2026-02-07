/**
 * Mark Reminder as Sent (Scrooge endpoint)
 *
 * PATCH /api/reminders/:rid/sent - Scrooge marks a reminder as sent
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ rid: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
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

    return NextResponse.json(data);
  } catch (err) {
    console.error('Mark reminder sent error:', err);
    logError('Failed to mark reminder as sent', { error: err as Error, source: 'api/reminders/[rid]/sent', context: { method: 'PATCH' } });
    return NextResponse.json({ error: 'Failed to mark reminder as sent' }, { status: 500 });
  }
}
