/**
 * The Counting House - ROI Dashboard API
 *
 * GET /api/dashboard/roi - Aggregate ROI across all events
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import type { EventType } from '@/types/database';

interface EventROIRow {
  id: string;
  name: string;
  event_type: EventType;
  pipeline_generated: number;
  revenue_closed: number;
  leads_generated: number;
  meetings_booked: number;
  opportunities_created: number;
  actual_spent: number;
  roi_ratio: number | null;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all non-deleted events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .is('deleted_at', null);

    if (eventsError) throw eventsError;

    // Fetch all non-deleted expenses with event_id
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('event_id, amount')
      .not('event_id', 'is', null)
      .is('deleted_at', null);

    if (expensesError) throw expensesError;

    // Build expense totals map
    const expenseByEvent = new Map<string, number>();
    for (const exp of expenses || []) {
      if (exp.event_id) {
        expenseByEvent.set(exp.event_id, (expenseByEvent.get(exp.event_id) || 0) + exp.amount);
      }
    }

    // Build event ROI rows
    const eventRows: EventROIRow[] = (events || []).map(event => {
      const actualSpent = expenseByEvent.get(event.id) || 0;
      const revenueClosed = event.revenue_closed ?? 0;
      const roiRatio = actualSpent > 0
        ? (revenueClosed - actualSpent) / actualSpent
        : null;

      return {
        id: event.id,
        name: event.name,
        event_type: event.event_type,
        pipeline_generated: event.pipeline_generated ?? 0,
        revenue_closed: revenueClosed,
        leads_generated: event.leads_generated ?? 0,
        meetings_booked: event.meetings_booked ?? 0,
        opportunities_created: event.opportunities_created ?? 0,
        actual_spent: actualSpent,
        roi_ratio: roiRatio,
      };
    });

    // Sort by ROI ratio descending (nulls at end)
    eventRows.sort((a, b) => {
      if (a.roi_ratio !== null && b.roi_ratio !== null) return b.roi_ratio - a.roi_ratio;
      if (a.roi_ratio !== null) return -1;
      if (b.roi_ratio !== null) return 1;
      return 0;
    });

    // Aggregate totals
    const totals = eventRows.reduce(
      (acc, row) => ({
        total_spent: acc.total_spent + row.actual_spent,
        total_pipeline: acc.total_pipeline + row.pipeline_generated,
        total_revenue: acc.total_revenue + row.revenue_closed,
        total_leads: acc.total_leads + row.leads_generated,
        total_meetings: acc.total_meetings + row.meetings_booked,
        total_opportunities: acc.total_opportunities + row.opportunities_created,
      }),
      { total_spent: 0, total_pipeline: 0, total_revenue: 0, total_leads: 0, total_meetings: 0, total_opportunities: 0 }
    );

    const overallRoiRatio = totals.total_spent > 0
      ? (totals.total_revenue - totals.total_spent) / totals.total_spent
      : null;

    // Breakdown by event_type
    const typeMap = new Map<EventType, { spent: number; pipeline: number; revenue: number; leads: number; meetings: number; opportunities: number; count: number }>();
    for (const row of eventRows) {
      const existing = typeMap.get(row.event_type) || { spent: 0, pipeline: 0, revenue: 0, leads: 0, meetings: 0, opportunities: 0, count: 0 };
      typeMap.set(row.event_type, {
        spent: existing.spent + row.actual_spent,
        pipeline: existing.pipeline + row.pipeline_generated,
        revenue: existing.revenue + row.revenue_closed,
        leads: existing.leads + row.leads_generated,
        meetings: existing.meetings + row.meetings_booked,
        opportunities: existing.opportunities + row.opportunities_created,
        count: existing.count + 1,
      });
    }

    const byEventType = Array.from(typeMap.entries()).map(([type, data]) => ({
      event_type: type,
      event_count: data.count,
      total_spent: data.spent,
      total_pipeline: data.pipeline,
      total_revenue: data.revenue,
      total_leads: data.leads,
      total_meetings: data.meetings,
      total_opportunities: data.opportunities,
      roi_ratio: data.spent > 0 ? (data.revenue - data.spent) / data.spent : null,
    }));

    return NextResponse.json({
      totals: {
        ...totals,
        overall_roi_ratio: overallRoiRatio,
        event_count: eventRows.length,
      },
      events: eventRows,
      by_event_type: byEventType,
    });
  } catch (error) {
    console.error('ROI Dashboard API error:', error);
    logError('Failed to fetch ROI dashboard', { error: error as Error, source: 'api/dashboard/roi', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to fetch ROI dashboard data' },
      { status: 500 }
    );
  }
}
