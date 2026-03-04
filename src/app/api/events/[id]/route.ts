/**
 * Ghostly - Single Event API
 *
 * Endpoints:
 * GET /api/events/[id] - Get a single event with its expenses
 * PUT /api/events/[id] - Update an event
 * DELETE /api/events/[id] - Soft delete an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeChanges } from '@/lib/audit';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import type { QuarterType, EventTypeRecord } from '@/types/database';

type RouteContext = { params: Promise<{ id: string }> };

// ============================================
// GET /api/events/[id]
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'events' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, event_types(*), fiscal_years(*)')
      .eq('id', id)
      .eq('organization_id', orgId)
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
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false });

    if (expensesError) throw expensesError;

    const expenseList = expenses || [];
    const actualSpent = expenseList
      .filter((e) => e.budget_bucket !== 'travel')
      .reduce((sum, e) => sum + e.amount, 0);
    const budgetAmount = event.budget_amount ?? 0;

    // Extract event_types and fiscal_years join results
    const { event_types, fiscal_years, ...eventData } = event as typeof event & { event_types: EventTypeRecord | null; fiscal_years: Record<string, unknown> | null };

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
      expense_count: expenseList.filter((e) => e.budget_bucket !== 'travel').length,
    };

    return NextResponse.json({
      event: eventWithTotals,
      expenses: expenseList,
      fiscal_year: fiscal_years ?? null,
    });
  }
);

// ============================================
// PUT /api/events/[id]
// ============================================

export const PUT = withApiHandler({ permission: 'write', resource: 'events' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    // Check if event exists
    const { data: existingEvent, error: findError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
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

    // Validate quarter if provided
    if (body.quarter && !['Q1', 'Q2', 'Q3', 'Q4', 'TBD'].includes(body.quarter)) {
      return NextResponse.json(
        { error: 'Invalid quarter. Must be one of: Q1, Q2, Q3, Q4, TBD' },
        { status: 400 }
      );
    }

    // Validate stage if provided
    const validStages = ['confirmed', 'in_progress', 'ready', 'active', 'debrief', 'archived'];
    if (body.stage !== undefined && !validStages.includes(body.stage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${validStages.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate tier if provided
    const validTiers = ['executive', 'national_t1', 'national_t2', 'state_t1', 'state_t2', 'customer_partner'];
    if (body.tier !== undefined && body.tier !== null && !validTiers.includes(body.tier)) {
      return NextResponse.json(
        { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate shipping_handler if provided
    if (body.shipping_handler !== undefined && !['handler_a', 'handler_b'].includes(body.shipping_handler)) {
      return NextResponse.json(
        { error: 'Invalid shipping_handler. Must be "handler_a" or "handler_b"' },
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
        .eq('organization_id', orgId)
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
    if (eventTypeRecord) {
      updateData.event_type_id = body.event_type_id;
    }
    if (body.quarter !== undefined) updateData.quarter = body.quarter as QuarterType;
    if (body.fiscal_year_id !== undefined) updateData.fiscal_year_id = body.fiscal_year_id?.trim() || null;
    if (body.date_start !== undefined) updateData.date_start = body.date_start?.trim() || null;
    if (body.date_end !== undefined) updateData.date_end = body.date_end?.trim() || null;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.budget_amount !== undefined) updateData.budget_amount = parseFloat(body.budget_amount);
    if (body.expansion_goal !== undefined) updateData.expansion_goal = parseInt(body.expansion_goal) || 0;
    if (body.net_new_goal !== undefined) updateData.net_new_goal = parseInt(body.net_new_goal) || 0;
    if (body.approach_notes !== undefined) updateData.approach_notes = body.approach_notes;
    if (body.marketing_notes !== undefined) updateData.marketing_notes = body.marketing_notes;
    if (body.sales_notes !== undefined) updateData.sales_notes = body.sales_notes;
    if (body.pipeline_generated !== undefined) updateData.pipeline_generated = parseFloat(body.pipeline_generated) || 0;
    if (body.revenue_closed !== undefined) updateData.revenue_closed = parseFloat(body.revenue_closed) || 0;
    if (body.leads_generated !== undefined) updateData.leads_generated = parseInt(body.leads_generated) || 0;
    if (body.meetings_booked !== undefined) updateData.meetings_booked = parseInt(body.meetings_booked) || 0;
    if (body.opportunities_created !== undefined) updateData.opportunities_created = parseInt(body.opportunities_created) || 0;
    if (body.roi_notes !== undefined) updateData.roi_notes = body.roi_notes;
    if (body.stage !== undefined) updateData.stage = body.stage;
    if (body.tier !== undefined) updateData.tier = body.tier;
    if (body.shipping_handler !== undefined) updateData.shipping_handler = body.shipping_handler;

    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .select('*, event_types(*)')
      .single();

    if (updateError) throw updateError;

    // Query expenses for totals
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('event_id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    const expenseList = expenses || [];
    const actualSpent = expenseList
      .filter((e) => e.budget_bucket !== 'travel')
      .reduce((sum, e) => sum + e.amount, 0);
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
      expense_count: expenseList.filter((e) => e.budget_bucket !== 'travel').length,
    };

    // Audit log (non-blocking)
    const auditFields = ['name', 'event_type_id', 'quarter', 'fiscal_year_id', 'date_start', 'date_end', 'location', 'budget_amount', 'expansion_goal', 'net_new_goal', 'approach_notes', 'marketing_notes', 'sales_notes', 'pipeline_generated', 'revenue_closed', 'leads_generated', 'meetings_booked', 'opportunities_created', 'roi_notes', 'stage', 'tier', 'shipping_handler'];
    const changes = computeChanges(existingEvent as Record<string, unknown>, updatedEvent as Record<string, unknown>, auditFields);
    await auditMutation(request, {
      entity_type: 'event',
      entity_id: id,
      action: 'update',
      changes,
    });

    return NextResponse.json(eventWithTotals);
  }
);

// ============================================
// DELETE /api/events/[id]
// ============================================

export const DELETE = withApiHandler({ permission: 'write', resource: 'events' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    // Check if event exists
    const { data: existingEvent, error: findError } = await supabase
      .from('events')
      .select('id')
      .eq('id', id)
      .eq('organization_id', orgId)
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
      .eq('id', id)
      .eq('organization_id', orgId);

    if (deleteError) throw deleteError;

    // Audit log (non-blocking)
    await auditMutation(request, {
      entity_type: 'event',
      entity_id: id,
      action: 'delete',
      changes: null,
    });

    return NextResponse.json({
      message: 'Event deleted successfully',
      id,
    });
  }
);
