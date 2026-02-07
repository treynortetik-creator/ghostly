/**
 * Event Reminders API
 *
 * GET /api/events/:id/reminders - Get reminders for an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const { id: eventId } = await context.params;
    const supabase = await createClient();

    const { data: reminders, error } = await supabase
      .from('event_reminders')
      .select('*')
      .eq('event_id', eventId)
      .order('reminder_date', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      reminders: reminders || [],
      meta: { total: (reminders || []).length },
    });
  } catch (err) {
    console.error('Event reminders API error:', err);
    logError('Failed to fetch event reminders', { error: err as Error, source: 'api/events/[id]/reminders', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch event reminders' }, { status: 500 });
  }
}
