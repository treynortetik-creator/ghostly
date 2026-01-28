/**
 * The Counting House - Events API
 *
 * Endpoints:
 * GET /api/events - List all events with optional filters
 * POST /api/events - Create a new event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import type { EventType, QuarterType } from '@/types/database';

interface EventWithTotals {
  id: string;
  name: string;
  event_type: EventType;
  quarter: QuarterType | null;
  fiscal_year_id: string | null;
  date_start: string | null;
  date_end: string | null;
  location: string | null;
  budget_amount: number;
  expansion_goal: number;
  net_new_goal: number;
  approach_notes: string | null;
  marketing_notes: string | null;
  sales_notes: string | null;
  pipeline_generated: number;
  revenue_closed: number;
  leads_generated: number;
  meetings_booked: number;
  opportunities_created: number;
  roi_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  actual_spent: number;
  remaining: number;
  expense_count: number;
}

// ============================================
// GET /api/events
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const eventType = searchParams.get('type') as EventType | null;
    const quarter = searchParams.get('quarter') as QuarterType | null;
    const fiscalYearId = searchParams.get('fiscal_year_id');

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // Build filters object
    const filters: {
      event_type?: EventType;
      quarter?: QuarterType;
      fiscal_year_id?: string;
    } = {};

    if (eventType && ['executive', 'national', 'state', 'regional', 'customer'].includes(eventType)) {
      filters.event_type = eventType;
    }
    if (quarter && ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'].includes(quarter)) {
      filters.quarter = quarter;
    }
    if (fiscalYearId) {
      filters.fiscal_year_id = fiscalYearId;
    }

    const supabase = await createClient();

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (filters.event_type) query = query.eq('event_type', filters.event_type);
    if (filters.quarter) query = query.eq('quarter', filters.quarter);
    if (filters.fiscal_year_id) query = query.eq('fiscal_year_id', filters.fiscal_year_id);

    // Fetch paginated events and all event expense totals in parallel (avoids N+1)
    const [eventsResult, expenseTotalsResult] = await Promise.all([
      query.order('date_start', { ascending: true, nullsFirst: false }).range(from, to),
      supabase
        .from('expenses')
        .select('event_id, amount')
        .not('event_id', 'is', null)
        .is('deleted_at', null),
    ]);

    if (eventsResult.error) throw eventsResult.error;

    const total = eventsResult.count ?? 0;

    // Build expense totals map from single query
    const expenseByEvent = new Map<string, { total: number; count: number }>();
    for (const exp of expenseTotalsResult.data || []) {
      if (exp.event_id) {
        const prev = expenseByEvent.get(exp.event_id) || { total: 0, count: 0 };
        expenseByEvent.set(exp.event_id, { total: prev.total + exp.amount, count: prev.count + 1 });
      }
    }

    const events: EventWithTotals[] = (eventsResult.data || []).map(event => {
      const stats = expenseByEvent.get(event.id) || { total: 0, count: 0 };
      return {
        ...event,
        budget_amount: event.budget_amount ?? 0,
        expansion_goal: event.expansion_goal ?? 0,
        net_new_goal: event.net_new_goal ?? 0,
        pipeline_generated: event.pipeline_generated ?? 0,
        revenue_closed: event.revenue_closed ?? 0,
        leads_generated: event.leads_generated ?? 0,
        meetings_booked: event.meetings_booked ?? 0,
        opportunities_created: event.opportunities_created ?? 0,
        roi_notes: event.roi_notes ?? null,
        actual_spent: stats.total,
        remaining: (event.budget_amount ?? 0) - stats.total,
        expense_count: stats.count,
      };
    });

    // Sort by date_start (null dates at end), then by name
    events.sort((a, b) => {
      if (a.date_start && b.date_start) {
        return a.date_start.localeCompare(b.date_start);
      }
      if (a.date_start && !b.date_start) return -1;
      if (!a.date_start && b.date_start) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      events,
      meta: {
        total,
        filters_applied: filters,
      },
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });
  } catch (err) {
    console.error('Events API error:', err);
    logError('Failed to fetch events', { error: err as Error, source: 'api/events', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/events
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'event_type', 'quarter', 'budget_amount'];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate input lengths
    if (String(body.name).length > 200) {
      return NextResponse.json(
        { error: 'Event name must be 200 characters or fewer' },
        { status: 400 }
      );
    }

    // Validate event_type
    if (!['executive', 'national', 'state', 'regional', 'customer'].includes(body.event_type)) {
      return NextResponse.json(
        { error: 'Invalid event_type. Must be one of: executive, national, state, regional, customer' },
        { status: 400 }
      );
    }

    // Validate quarter
    if (!['Q1', 'Q2', 'Q3', 'Q4', 'TBD'].includes(body.quarter)) {
      return NextResponse.json(
        { error: 'Invalid quarter. Must be one of: Q1, Q2, Q3, Q4, TBD' },
        { status: 400 }
      );
    }

    // Validate budget_amount is a positive number
    const budgetAmount = parseFloat(body.budget_amount);
    if (isNaN(budgetAmount) || budgetAmount < 0) {
      return NextResponse.json(
        { error: 'Invalid budget_amount. Must be a positive number' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Coerce empty strings to null for nullable typed columns (uuid, date)
    const fiscalYearId = body.fiscal_year_id?.trim() || null;
    const dateStart = body.date_start?.trim() || null;
    const dateEnd = body.date_end?.trim() || null;

    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert({
        name: body.name,
        event_type: body.event_type as EventType,
        quarter: body.quarter as QuarterType,
        fiscal_year_id: fiscalYearId,
        date_start: dateStart,
        date_end: dateEnd,
        location: body.location || null,
        budget_amount: budgetAmount,
        expansion_goal: parseInt(body.expansion_goal) || 0,
        net_new_goal: parseInt(body.net_new_goal) || 0,
        approach_notes: body.approach_notes || null,
        marketing_notes: body.marketing_notes || null,
        sales_notes: body.sales_notes || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      ...newEvent,
      budget_amount: newEvent.budget_amount ?? 0,
      expansion_goal: newEvent.expansion_goal ?? 0,
      net_new_goal: newEvent.net_new_goal ?? 0,
      pipeline_generated: newEvent.pipeline_generated ?? 0,
      revenue_closed: newEvent.revenue_closed ?? 0,
      leads_generated: newEvent.leads_generated ?? 0,
      meetings_booked: newEvent.meetings_booked ?? 0,
      opportunities_created: newEvent.opportunities_created ?? 0,
      roi_notes: newEvent.roi_notes ?? null,
      actual_spent: 0,
      remaining: newEvent.budget_amount ?? 0,
      expense_count: 0,
    }, { status: 201 });
  } catch (err) {
    console.error('Create event error:', err);
    logError('Failed to create event', { error: err as Error, source: 'api/events', context: { method: 'POST' } });
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
