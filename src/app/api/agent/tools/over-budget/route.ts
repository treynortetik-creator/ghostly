/**
 * Agent Tool API - Get Over Budget Events
 *
 * GET /api/agent/tools/over-budget
 * Returns events where actual spending exceeds the budget amount.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'agent-tools' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    // Fetch all events and expense totals for the org
    const [eventsResult, expenseTotalsResult] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, quarter, budget_amount, date_start, date_end, location')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      supabase
        .from('expenses')
        .select('event_id, amount')
        .eq('organization_id', orgId)
        .not('event_id', 'is', null)
        .neq('budget_bucket', 'travel')
        .is('deleted_at', null),
    ]);

    if (eventsResult.error) throw eventsResult.error;

    // Build expense totals map
    const expenseByEvent = new Map<string, number>();
    for (const exp of expenseTotalsResult.data || []) {
      if (exp.event_id) {
        expenseByEvent.set(
          exp.event_id,
          (expenseByEvent.get(exp.event_id) || 0) + exp.amount
        );
      }
    }

    // Find over-budget events
    const overBudget = (eventsResult.data || [])
      .map((event) => {
        const actualSpent = expenseByEvent.get(event.id) || 0;
        const budget = event.budget_amount || 0;
        return {
          id: event.id,
          name: event.name,
          quarter: event.quarter,
          budget_amount: budget,
          actual_spent: actualSpent,
          over_by: actualSpent - budget,
          date_start: event.date_start,
          location: event.location,
        };
      })
      .filter((e) => e.over_by > 0)
      .sort((a, b) => b.over_by - a.over_by);

    return NextResponse.json({
      over_budget_events: overBudget,
      total: overBudget.length,
    });
  }
);
