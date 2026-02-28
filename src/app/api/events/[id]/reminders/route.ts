/**
 * Event Reminders API
 *
 * GET /api/events/:id/reminders - Get reminders for an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'events/reminders' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const supabase = await createClient();

    // Verify event belongs to org
    const { data: eventCheck } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

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
  }
);
