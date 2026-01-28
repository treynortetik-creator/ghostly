/**
 * The Counting House - Single Event API
 *
 * Endpoints:
 * GET /api/events/[id] - Get a single event with its expenses
 * PUT /api/events/[id] - Update an event
 * DELETE /api/events/[id] - Soft delete an event
 */

import { NextRequest, NextResponse } from 'next/server';
import type { EventType, QuarterType } from '@/types/database';
import {
  getEventById,
  getEventWithTotals,
  getExpensesByEventId,
  mockFiscalYear,
} from '@/lib/mock-data/events';

// ============================================
// GET /api/events/[id]
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: Replace with real Supabase query when connected
    // const supabase = await createClient();
    // const { data: event, error } = await supabase
    //   .from('events')
    //   .select('*, expenses(*)')
    //   .eq('id', id)
    //   .is('deleted_at', null)
    //   .single();

    const event = getEventById(id);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const eventWithTotals = getEventWithTotals(event);
    const expenses = getExpensesByEventId(id);

    return NextResponse.json({
      event: eventWithTotals,
      expenses,
      fiscal_year: mockFiscalYear,
    });
  } catch (error) {
    console.error('Get event error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/events/[id]
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if event exists
    const existingEvent = getEventById(id);
    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Validate event_type if provided
    if (body.event_type && !['executive', 'national', 'state', 'regional', 'customer'].includes(body.event_type)) {
      return NextResponse.json(
        { error: 'Invalid event_type. Must be one of: executive, national, state, regional, customer' },
        { status: 400 }
      );
    }

    // Validate quarter if provided
    if (body.quarter && !['Q1', 'Q2', 'Q3', 'Q4', 'TBD'].includes(body.quarter)) {
      return NextResponse.json(
        { error: 'Invalid quarter. Must be one of: Q1, Q2, Q3, Q4, TBD' },
        { status: 400 }
      );
    }

    // Validate budget_amount if provided
    if (body.budget_amount !== undefined) {
      const budgetAmount = parseFloat(body.budget_amount);
      if (isNaN(budgetAmount) || budgetAmount < 0) {
        return NextResponse.json(
          { error: 'Invalid budget_amount. Must be a positive number' },
          { status: 400 }
        );
      }
    }

    // TODO: Replace with real Supabase update when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase
    //   .from('events')
    //   .update({ ...body, updated_at: new Date().toISOString() })
    //   .eq('id', id)
    //   .select()
    //   .single();

    // Create updated event (mock)
    const now = new Date().toISOString();
    const updatedEvent = {
      ...existingEvent,
      name: body.name ?? existingEvent.name,
      event_type: (body.event_type ?? existingEvent.event_type) as EventType,
      quarter: (body.quarter ?? existingEvent.quarter) as QuarterType,
      fiscal_year_id: body.fiscal_year_id ?? existingEvent.fiscal_year_id,
      date_start: body.date_start !== undefined ? body.date_start : existingEvent.date_start,
      date_end: body.date_end !== undefined ? body.date_end : existingEvent.date_end,
      location: body.location !== undefined ? body.location : existingEvent.location,
      budget_amount: body.budget_amount !== undefined ? parseFloat(body.budget_amount) : existingEvent.budget_amount,
      expansion_goal: body.expansion_goal !== undefined ? parseInt(body.expansion_goal) : existingEvent.expansion_goal,
      net_new_goal: body.net_new_goal !== undefined ? parseInt(body.net_new_goal) : existingEvent.net_new_goal,
      approach_notes: body.approach_notes !== undefined ? body.approach_notes : existingEvent.approach_notes,
      marketing_notes: body.marketing_notes !== undefined ? body.marketing_notes : existingEvent.marketing_notes,
      sales_notes: body.sales_notes !== undefined ? body.sales_notes : existingEvent.sales_notes,
      updated_at: now,
    };

    const eventWithTotals = getEventWithTotals(updatedEvent);

    return NextResponse.json(eventWithTotals);
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/events/[id]
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if event exists
    const existingEvent = getEventById(id);
    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // TODO: Replace with real Supabase soft delete when connected
    // const supabase = await createClient();
    // const { error } = await supabase
    //   .from('events')
    //   .update({ deleted_at: new Date().toISOString() })
    //   .eq('id', id);

    // Soft delete (mock) - just return success
    // In real implementation, we would set deleted_at

    return NextResponse.json({
      message: 'Event deleted successfully',
      id,
    });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
