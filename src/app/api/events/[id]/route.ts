/**
 * The Counting House - Single Event API
 *
 * Endpoints:
 * GET /api/events/[id] - Get a single event with its expenses
 * PUT /api/events/[id] - Update an event
 * DELETE /api/events/[id] - Soft delete an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit, getActor, computeChanges } from '@/lib/audit';
import type { EventType, QuarterType, EventTypeRecord } from '@/types/database';

// ============================================
// GET /api/events/[id]
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, event_types(*)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (eventError?.code === 'PGRST116' || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (eventError) throw eventError;

    // Query expenses for this event
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('event_id', id)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false });

    if (expensesError) throw expensesError;

    const expenseList = expenses || [];
    const actualSpent = expenseList.reduce((sum, e) => sum + e.amount, 0);
    const budgetAmount = event.budget_amount ?? 0;

    // Extract event_types join result and rename to event_type_record
    const { event_types, ...eventData } = event as typeof event & { event_types: EventTypeRecord | null };

    const eventWithTotals = {
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
      actual_spent: actualSpent,
      remaining: budgetAmount - actualSpent,
      expense_count: expenseList.length,
    };

    // Query fiscal year if event has one
    let fiscalYear = null;
    if (event.fiscal_year_id) {
      const { data: fy } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', event.fiscal_year_id)
        .single();
      fiscalYear = fy;
    }

    return NextResponse.json({
      event: eventWithTotals,
      expenses: expenseList,
      fiscal_year: fiscalYear,
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
    const supabase = await createClient();

    // Check if event exists
    const { data: existingEvent, error: findError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (findError?.code === 'PGRST116' || !existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (findError) throw findError;

    // Validate name length if provided
    if (body.name !== undefined && String(body.name).length > 200) {
      return NextResponse.json(
        { error: 'Event name must be 200 characters or fewer' },
        { status: 400 }
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

    // Validate and lookup event_type_id if provided
    let eventTypeRecord: EventTypeRecord | null = null;
    if (body.event_type_id !== undefined && body.event_type_id !== null && body.event_type_id !== '') {
      const { data: eventType, error: eventTypeError } = await supabase
        .from('event_types')
        .select('*')
        .eq('id', body.event_type_id)
        .single();

      if (eventTypeError || !eventType) {
        return NextResponse.json(
          { error: 'Invalid event_type_id. Event type not found.' },
          { status: 400 }
        );
      }
      eventTypeRecord = eventType as EventTypeRecord;
    }

    // Build update payload
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    // If event_type_id is provided, update both event_type_id and event_type for backward compatibility
    if (eventTypeRecord) {
      updateData.event_type_id = body.event_type_id;
      updateData.event_type = eventTypeRecord.name.toLowerCase() as EventType;
    } else if (body.event_type !== undefined) {
      // Legacy: direct event_type update (deprecated)
      updateData.event_type = body.event_type as EventType;
    }
    if (body.quarter !== undefined) updateData.quarter = body.quarter as QuarterType;
    if (body.fiscal_year_id !== undefined) updateData.fiscal_year_id = body.fiscal_year_id?.trim() || null;
    if (body.date_start !== undefined) updateData.date_start = body.date_start?.trim() || null;
    if (body.date_end !== undefined) updateData.date_end = body.date_end?.trim() || null;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.budget_amount !== undefined) updateData.budget_amount = parseFloat(body.budget_amount);
    if (body.expansion_goal !== undefined) updateData.expansion_goal = parseInt(body.expansion_goal);
    if (body.net_new_goal !== undefined) updateData.net_new_goal = parseInt(body.net_new_goal);
    if (body.approach_notes !== undefined) updateData.approach_notes = body.approach_notes;
    if (body.marketing_notes !== undefined) updateData.marketing_notes = body.marketing_notes;
    if (body.sales_notes !== undefined) updateData.sales_notes = body.sales_notes;
    if (body.pipeline_generated !== undefined) updateData.pipeline_generated = parseFloat(body.pipeline_generated) || 0;
    if (body.revenue_closed !== undefined) updateData.revenue_closed = parseFloat(body.revenue_closed) || 0;
    if (body.leads_generated !== undefined) updateData.leads_generated = parseInt(body.leads_generated) || 0;
    if (body.meetings_booked !== undefined) updateData.meetings_booked = parseInt(body.meetings_booked) || 0;
    if (body.opportunities_created !== undefined) updateData.opportunities_created = parseInt(body.opportunities_created) || 0;
    if (body.roi_notes !== undefined) updateData.roi_notes = body.roi_notes;

    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*, event_types(*)')
      .single();

    if (updateError) throw updateError;

    // Query expenses for totals
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('event_id', id)
      .is('deleted_at', null);

    const expenseList = expenses || [];
    const actualSpent = expenseList.reduce((sum, e) => sum + e.amount, 0);
    const budgetAmount = updatedEvent.budget_amount ?? 0;

    // Extract event_types join result and rename to event_type_record
    const { event_types: updatedEventTypes, ...updatedEventData } = updatedEvent as typeof updatedEvent & { event_types: EventTypeRecord | null };

    const eventWithTotals = {
      ...updatedEventData,
      event_type_record: updatedEventTypes ?? null,
      budget_amount: budgetAmount,
      expansion_goal: updatedEvent.expansion_goal ?? 0,
      net_new_goal: updatedEvent.net_new_goal ?? 0,
      pipeline_generated: updatedEvent.pipeline_generated ?? 0,
      revenue_closed: updatedEvent.revenue_closed ?? 0,
      leads_generated: updatedEvent.leads_generated ?? 0,
      meetings_booked: updatedEvent.meetings_booked ?? 0,
      opportunities_created: updatedEvent.opportunities_created ?? 0,
      roi_notes: updatedEvent.roi_notes ?? null,
      actual_spent: actualSpent,
      remaining: budgetAmount - actualSpent,
      expense_count: expenseList.length,
    };

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      const auditFields = ['name', 'event_type_id', 'quarter', 'fiscal_year_id', 'date_start', 'date_end', 'location', 'budget_amount', 'expansion_goal', 'net_new_goal', 'approach_notes', 'marketing_notes', 'sales_notes', 'pipeline_generated', 'revenue_closed', 'leads_generated', 'meetings_booked', 'opportunities_created', 'roi_notes'];
      const changes = computeChanges(existingEvent as Record<string, unknown>, updatedEvent as Record<string, unknown>, auditFields);
      logAudit({
        entity_type: 'event',
        entity_id: id,
        action: 'update',
        changes,
        actor,
        actor_type,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

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
    const supabase = await createClient();

    // Check if event exists
    const { data: existingEvent, error: findError } = await supabase
      .from('events')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (findError?.code === 'PGRST116' || !existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (findError) throw findError;

    // Soft delete
    const { error: deleteError } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      logAudit({
        entity_type: 'event',
        entity_id: id,
        action: 'delete',
        changes: null,
        actor,
        actor_type,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

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
