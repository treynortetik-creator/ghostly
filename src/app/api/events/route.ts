/**
 * The Counting House - Events API
 *
 * Endpoints:
 * GET /api/events - List all events with optional filters
 * POST /api/events - Create a new event
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-logger';
import type { EventType, QuarterType, EventInsert } from '@/types/database';
import {
  mockEvents,
  mockFiscalYear,
  getEvents,
  type EventWithTotals,
} from '@/lib/mock-data/events';
import { allExpenses } from '@/lib/mock-data/expenses';

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

    // TODO: Replace with real Supabase queries when connected
    // const supabase = await createClient();
    // let query = supabase.from('events').select('*').is('deleted_at', null);
    // if (filters.event_type) query = query.eq('event_type', filters.event_type);
    // if (filters.quarter) query = query.eq('quarter', filters.quarter);
    // if (filters.fiscal_year_id) query = query.eq('fiscal_year_id', filters.fiscal_year_id);
    // const { data, error } = await query.order('date_start', { ascending: true });

    // Use getEvents for filtering, then compute totals from consolidated allExpenses
    const filteredEvents = getEvents(filters);
    const events: EventWithTotals[] = filteredEvents.map(event => {
      const eventExpenses = allExpenses.filter(e => e.event_id === event.id && !e.deleted_at);
      const actualSpent = eventExpenses.reduce((sum, e) => sum + e.amount, 0);
      return {
        ...event,
        actual_spent: actualSpent,
        remaining: event.budget_amount - actualSpent,
        expense_count: eventExpenses.length,
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
        total: events.length,
        filters_applied: filters,
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

    // TODO: Replace with real Supabase insert when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase.from('events').insert(eventData).select().single();

    // Create mock event
    const now = new Date().toISOString();
    const newEvent: EventWithTotals = {
      id: `evt-new-${Date.now()}`,
      name: body.name,
      event_type: body.event_type as EventType,
      quarter: body.quarter as QuarterType,
      fiscal_year_id: body.fiscal_year_id || mockFiscalYear.id,
      date_start: body.date_start || null,
      date_end: body.date_end || null,
      location: body.location || null,
      budget_amount: budgetAmount,
      expansion_goal: parseInt(body.expansion_goal) || 0,
      net_new_goal: parseInt(body.net_new_goal) || 0,
      approach_notes: body.approach_notes || null,
      marketing_notes: body.marketing_notes || null,
      sales_notes: body.sales_notes || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      actual_spent: 0,
      remaining: budgetAmount,
      expense_count: 0,
    };

    // In a real implementation, we would add to the database
    // For mock purposes, we'll just return the created event
    // mockEvents.push(newEvent); // Not persisting in mock

    return NextResponse.json(newEvent, { status: 201 });
  } catch (err) {
    console.error('Create event error:', err);
    logError('Failed to create event', { error: err as Error, source: 'api/events', context: { method: 'POST' } });
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
