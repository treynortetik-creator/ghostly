/**
 * Agent Tool API - Get Overdue Tasks
 *
 * GET /api/agent/tools/overdue-tasks
 * Returns checklist items past their due date that are not yet completed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'agent-tools' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('event_checklist_items')
      .select(`
        id,
        title,
        description,
        phase,
        due_date,
        sort_order,
        event_id,
        events!inner(id, name, organization_id)
      `)
      .is('completed_at', null)
      .lt('due_date', today)
      .not('due_date', 'is', null);

    // Filter by org via the events join
    query = query.eq('events.organization_id', orgId);

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    query = query.order('due_date', { ascending: true }).limit(50);

    const { data, error } = await query;
    if (error) throw error;

    const overdueTasks = (data ?? []).map((item: Record<string, unknown>) => {
      const event = item.events as Record<string, unknown> | null;
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        phase: item.phase,
        due_date: item.due_date,
        event_id: item.event_id,
        event_name: event?.name ?? null,
      };
    });

    return NextResponse.json({
      overdue_tasks: overdueTasks,
      total: overdueTasks.length,
    });
  }
);
