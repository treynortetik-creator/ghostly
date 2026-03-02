/**
 * Ghostly - Upcoming Events API
 *
 * GET /api/events/upcoming - List events starting within the next N days
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import type { EventTypeRecord } from '@/types/database';

export const GET = withApiHandler({ permission: 'read', resource: 'events/upcoming' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be a number between 1 and 365.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);

    const todayISO = now.toISOString().split('T')[0];
    const cutoffISO = cutoff.toISOString().split('T')[0];

    const supabase = await createClient();

    // Fetch upcoming events, expenses, checklist items, and team counts in parallel (scoped to org)
    const [eventsResult, expenseTotalsResult, checklistResult, teamCountsResult] = await Promise.all([
      supabase
        .from('events')
        .select('*, event_types(*)')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .gte('date_start', todayISO)
        .lte('date_start', cutoffISO)
        .order('date_start', { ascending: true }),
      supabase
        .from('expenses')
        .select('event_id, amount')
        .eq('organization_id', orgId)
        .not('event_id', 'is', null)
        .neq('budget_bucket', 'travel')
        .is('deleted_at', null),
      supabase
        .from('event_checklist_items')
        .select('event_id, completed_at'),
      supabase
        .from('event_team_assignments')
        .select('event_id'),
    ]);

    if (eventsResult.error) throw eventsResult.error;

    const eventIds = new Set((eventsResult.data || []).map(e => e.id));

    // Build expense totals map
    const expenseByEvent = new Map<string, { total: number; count: number }>();
    for (const exp of expenseTotalsResult.data || []) {
      if (exp.event_id && eventIds.has(exp.event_id)) {
        const prev = expenseByEvent.get(exp.event_id) || { total: 0, count: 0 };
        expenseByEvent.set(exp.event_id, { total: prev.total + exp.amount, count: prev.count + 1 });
      }
    }

    // Build checklist stats map
    const checklistByEvent = new Map<string, { total: number; completed: number }>();
    for (const item of checklistResult.data || []) {
      if (eventIds.has(item.event_id)) {
        const prev = checklistByEvent.get(item.event_id) || { total: 0, completed: 0 };
        checklistByEvent.set(item.event_id, {
          total: prev.total + 1,
          completed: prev.completed + (item.completed_at ? 1 : 0),
        });
      }
    }

    // Build team count map
    const teamCountByEvent = new Map<string, number>();
    for (const assignment of teamCountsResult.data || []) {
      if (eventIds.has(assignment.event_id)) {
        teamCountByEvent.set(assignment.event_id, (teamCountByEvent.get(assignment.event_id) || 0) + 1);
      }
    }

    const events = (eventsResult.data || []).map(event => {
      const expenseStats = expenseByEvent.get(event.id) || { total: 0, count: 0 };
      const checklistStats = checklistByEvent.get(event.id) || { total: 0, completed: 0 };
      const teamCount = teamCountByEvent.get(event.id) || 0;
      const budgetAmount = event.budget_amount ?? 0;

      // Extract event_types join result and rename to event_type_record
      const { event_types, ...eventData } = event as typeof event & { event_types: EventTypeRecord | null };

      return {
        ...eventData,
        event_type_record: event_types ?? null,
        budget_amount: budgetAmount,
        expansion_goal: event.expansion_goal ?? 0,
        net_new_goal: event.net_new_goal ?? 0,
        pipeline_generated: event.pipeline_generated ?? 0,
        revenue_closed: event.revenue_closed ?? 0,
        leads_generated: event.leads_generated ?? 0,
        meetings_booked: event.meetings_booked ?? 0,
        opportunities_created: event.opportunities_created ?? 0,
        roi_notes: event.roi_notes ?? null,
        actual_spent: expenseStats.total,
        remaining: budgetAmount - expenseStats.total,
        expense_count: expenseStats.count,
        checklist: {
          total: checklistStats.total,
          completed: checklistStats.completed,
        },
        team_count: teamCount,
      };
    });

    return NextResponse.json({
      events,
      meta: {
        total: events.length,
        days_ahead: days,
      },
    });
  }
);
