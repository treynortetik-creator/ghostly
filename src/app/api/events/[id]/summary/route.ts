/**
 * Ghostly - Event Summary API
 *
 * GET /api/events/[id]/summary - Quick stats for a single event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'events/summary' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    // Fetch event, expenses, checklist items, and team assignments in parallel
    const [eventResult, expensesResult, checklistResult, teamResult] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, date_start, date_end, budget_amount, pipeline_generated, revenue_closed, leads_generated, meetings_booked, opportunities_created, roi_notes')
        .eq('id', id)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .single(),
      supabase
        .from('expenses')
        .select('amount')
        .eq('event_id', id)
        .neq('budget_bucket', 'travel')
        .is('deleted_at', null),
      supabase
        .from('event_checklist_items')
        .select('completed_at')
        .eq('event_id', id),
      supabase
        .from('event_team_assignments')
        .select('id')
        .eq('event_id', id),
    ]);

    if (eventResult.error || !eventResult.data) {
      const status = eventResult.error?.code === 'PGRST116' || !eventResult.data ? 404 : 500;
      if (status === 500) throw eventResult.error;
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const event = eventResult.data;
    const expenses = expensesResult.data || [];
    const checklistItems = checklistResult.data || [];
    const teamAssignments = teamResult.data || [];

    const budgetAmount = event.budget_amount ?? 0;
    const actualSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const pipelineGenerated = event.pipeline_generated ?? 0;
    const revenueClosed = event.revenue_closed ?? 0;
    const leadsGenerated = event.leads_generated ?? 0;
    const meetingsBooked = event.meetings_booked ?? 0;
    const opportunitiesCreated = event.opportunities_created ?? 0;

    // Compute ROI metrics
    const roiRatio = actualSpent > 0
      ? (revenueClosed - actualSpent) / actualSpent
      : null;
    const costPerLead = leadsGenerated > 0
      ? actualSpent / leadsGenerated
      : null;
    const pipelineToSpendRatio = actualSpent > 0
      ? pipelineGenerated / actualSpent
      : null;

    return NextResponse.json({
      event_id: event.id,
      name: event.name,
      date_start: event.date_start,
      date_end: event.date_end,
      budget: budgetAmount,
      actual_spent: actualSpent,
      remaining: budgetAmount - actualSpent,
      expense_count: expenses.length,
      checklist_progress: {
        completed: checklistItems.filter(i => i.completed_at).length,
        total: checklistItems.length,
      },
      team_count: teamAssignments.length,
      roi_metrics: {
        pipeline_generated: pipelineGenerated,
        revenue_closed: revenueClosed,
        leads_generated: leadsGenerated,
        meetings_booked: meetingsBooked,
        opportunities_created: opportunitiesCreated,
        roi_ratio: roiRatio,
        cost_per_lead: costPerLead,
        pipeline_to_spend_ratio: pipelineToSpendRatio,
        roi_notes: event.roi_notes ?? null,
      },
    });
  }
);
