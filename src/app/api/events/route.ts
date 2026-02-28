/**
 * Ghostly - Events API
 *
 * Endpoints:
 * GET /api/events - List all events with optional filters
 * POST /api/events - Create a new event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withIdempotency } from '@/lib/idempotency';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import { parsePagination, paginationMeta, paginationRange } from '@/lib/pagination';
import { VALIDATION, VALID_QUARTERS } from '@/lib/validation';
import type { QuarterType, EventTypeRecord } from '@/types/database';

interface EventWithTotals {
  id: string;
  name: string;
  event_type_id: string | null;
  event_type_record: EventTypeRecord | null;
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

export const GET = withApiHandler({ permission: 'read', resource: 'events' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const eventTypeId = searchParams.get('event_type_id');
    const quarter = searchParams.get('quarter') as QuarterType | null;
    const fiscalYearId = searchParams.get('fiscal_year_id');
    const modifiedAfter = searchParams.get('modified_after');
    const idsParam = searchParams.get('ids');

    // Parse search parameter
    const search = searchParams.get('search')?.trim() || null;

    // Parse pagination parameters (supports both page-based and offset-based)
    const basePagination = parsePagination(searchParams);
    const offsetParam = searchParams.get('offset');
    let page: number;
    let from: number;
    if (offsetParam !== null) {
      from = Math.max(0, parseInt(offsetParam, 10) || 0);
      page = Math.floor(from / basePagination.pageSize) + 1;
    } else {
      page = basePagination.page;
      from = basePagination.offset;
    }
    const pagination = { page, pageSize: basePagination.pageSize, offset: from };
    const to = from + pagination.pageSize - 1;

    // Validate modified_after if provided
    if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }

    // Build filters object
    const filters: {
      event_type_id?: string;
      quarter?: QuarterType;
      fiscal_year_id?: string;
      modified_after?: string;
      ids?: string[];
    } = {};

    if (eventTypeId) {
      filters.event_type_id = eventTypeId;
    }
    if (quarter && ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'].includes(quarter)) {
      filters.quarter = quarter;
    }
    if (fiscalYearId) {
      filters.fiscal_year_id = fiscalYearId;
    }
    if (modifiedAfter) {
      filters.modified_after = modifiedAfter;
    }
    if (idsParam) {
      filters.ids = idsParam.split(',');
    }

    const supabase = await createClient();

    let query = supabase
      .from('events')
      .select('*, event_types(*)', { count: 'exact' })
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    if (filters.event_type_id) query = query.eq('event_type_id', filters.event_type_id);
    if (filters.quarter) query = query.eq('quarter', filters.quarter);
    if (filters.fiscal_year_id) query = query.eq('fiscal_year_id', filters.fiscal_year_id);
    if (filters.modified_after) query = query.gt('updated_at', filters.modified_after);
    if (filters.ids) query = query.in('id', filters.ids);
    if (search) query = query.ilike('name', `%${search}%`);

    // Fetch paginated events and all event expense totals in parallel (avoids N+1)
    const [eventsResult, expenseTotalsResult] = await Promise.all([
      query.order('date_start', { ascending: true, nullsFirst: false }).range(from, to),
      supabase
        .from('expenses')
        .select('event_id, amount')
        .eq('organization_id', orgId)
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
      // Extract event_types join result and rename to event_type_record
      const { event_types, ...eventData } = event as typeof event & { event_types: EventTypeRecord | null };
      return {
        ...eventData,
        event_type_record: event_types ?? null,
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
        ...paginationMeta(total, pagination),
        offset: from,
      },
    });
  }
);

// ============================================
// POST /api/events
// ============================================

export const POST = withIdempotency(
  withApiHandler({ permission: 'write', resource: 'events' },
    async (request: NextRequest) => {
      const orgId = getOrgId(request);
      const body = await request.json();

      // Validate required fields
      const requiredFields = ['name', 'event_type_id', 'quarter', 'budget_amount'];
      for (const field of requiredFields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
          return NextResponse.json(
            { error: `Missing required field: ${field}` },
            { status: 400 }
          );
        }
      }

      // Validate input lengths
      if (String(body.name).length > VALIDATION.NAME_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Event name must be ${VALIDATION.NAME_MAX_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }

      // Validate quarter
      if (!(VALID_QUARTERS as readonly string[]).includes(body.quarter)) {
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

      // Validate that event_type_id exists in event_types table
      const { data: eventType, error: eventTypeError } = await supabase
        .from('event_types')
        .select('id, name')
        .eq('id', body.event_type_id)
        .eq('organization_id', orgId)
        .single();

      if (eventTypeError || !eventType) {
        return NextResponse.json(
          { error: 'Invalid event_type_id. Event type not found.' },
          { status: 400 }
        );
      }

      // Coerce empty strings to null for nullable typed columns (uuid, date)
      const fiscalYearId = body.fiscal_year_id?.trim() || null;
      const dateStart = body.date_start?.trim() || null;
      const dateEnd = body.date_end?.trim() || null;

      // Duplicate check: prevent same event name within same fiscal year
      let dupeQuery = supabase
        .from('events')
        .select('id, name')
        .eq('organization_id', orgId)
        .eq('name', body.name)
        .is('deleted_at', null);
      if (fiscalYearId) {
        dupeQuery = dupeQuery.eq('fiscal_year_id', fiscalYearId);
      } else {
        dupeQuery = dupeQuery.is('fiscal_year_id', null);
      }
      const { data: existing } = await dupeQuery.limit(1);
      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: `Duplicate event: "${body.name}" already exists${fiscalYearId ? ' in this fiscal year' : ''}. Existing ID: ${existing[0].id}` },
          { status: 409 }
        );
      }

      const { data: newEvent, error: insertError } = await supabase
        .from('events')
        .insert({
          organization_id: orgId,
          name: body.name,
          event_type_id: body.event_type_id,
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
        .select('*, event_types(*)')
        .single();

      if (insertError) throw insertError;

      // Extract event_types join result and rename to event_type_record
      const { event_types, ...eventData } = newEvent as typeof newEvent & { event_types: EventTypeRecord | null };

      // Audit log (non-blocking)
      await auditMutation(request, {
        entity_type: 'event',
        entity_id: newEvent.id,
        action: 'create',
        changes: null,
      });

      return NextResponse.json({
        ...eventData,
        event_type_record: event_types ?? null,
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
    }
  )
);
