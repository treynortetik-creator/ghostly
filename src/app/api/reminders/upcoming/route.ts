/**
 * Upcoming Reminders API (AI agent endpoint)
 *
 * GET /api/reminders/upcoming?days=N - All pending reminders in date range
 *
 * Returns reminders with status 'pending' that fall within the next N days.
 * Default is 7 days if no param provided.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'reminders/upcoming' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam) : 7;

    if (isNaN(days) || days < 0) {
      return NextResponse.json({ error: 'days must be a non-negative integer' }, { status: 400 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    const endStr = endDate.toISOString().split('T')[0];

    const supabase = await createClient();

    // First get org's event IDs, then filter reminders
    const { data: orgEvents } = await supabase
      .from('events')
      .select('id')
      .eq('organization_id', orgId);

    const orgEventIds = (orgEvents || []).map(e => e.id);

    if (orgEventIds.length === 0) {
      return NextResponse.json({
        reminders: [],
        meta: { total: 0, date_range: { from: todayStr, to: endStr, days } },
      });
    }

    const { data: reminders, error } = await supabase
      .from('event_reminders')
      .select('*, events(name, date_start)')
      .in('event_id', orgEventIds)
      .eq('status', 'pending')
      .gte('reminder_date', todayStr)
      .lte('reminder_date', endStr)
      .order('reminder_date', { ascending: true });

    if (error) throw error;

    const result = (reminders || []).map(r => ({
      ...r,
      event_name: (r.events as { name: string; date_start: string | null } | null)?.name || null,
      event_date_start: (r.events as { name: string; date_start: string | null } | null)?.date_start || null,
      events: undefined,
    }));

    return NextResponse.json({
      reminders: result,
      meta: {
        total: result.length,
        date_range: { from: todayStr, to: endStr, days },
      },
    });
  }
);
