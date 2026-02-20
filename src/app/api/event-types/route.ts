/**
 * The Counting House - Event Types API
 *
 * Endpoints:
 * GET /api/event-types - List event types for a fiscal year
 * POST /api/event-types - Create a new event type
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';
import type { AuditEntityType } from '@/lib/audit';

interface EventTypeWithTotals {
  id: string;
  name: string;
  description: string | null;
  fiscal_year_id: string | null;
  budget_amount: number;
  is_archived: boolean;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
  actual_spent: number;
  event_count: number;
  remaining: number;
}

// ============================================
// GET /api/event-types
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'event-types' },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const fiscalYearId = searchParams.get('fiscal_year_id');
    const includeArchived = searchParams.get('include_archived') === 'true';
    const modifiedAfter = searchParams.get('modified_after');
    const idsParam = searchParams.get('ids');

    if (!fiscalYearId) {
      return NextResponse.json(
        { error: 'fiscal_year_id is required' },
        { status: 400 }
      );
    }

    // Validate modified_after if provided
    if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }

    const filters: { fiscal_year_id: string; modified_after?: string } = {
      fiscal_year_id: fiscalYearId,
    };
    if (modifiedAfter) {
      filters.modified_after = modifiedAfter;
    }

    const supabase = await createClient();

    let query = supabase
      .from('event_types')
      .select('*')
      .eq('fiscal_year_id', fiscalYearId)
      .order('display_order', { ascending: true });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }
    if (filters.modified_after) {
      query = query.gt('updated_at', filters.modified_after);
    }
    if (idsParam) {
      query = query.in('id', idsParam.split(','));
    }

    const [eventTypesResult, eventsResult, expensesResult] = await Promise.all([
      query,
      supabase
        .from('events')
        .select('id, event_type_id, budget_amount')
        .eq('fiscal_year_id', fiscalYearId)
        .is('deleted_at', null),
      supabase
        .from('expenses')
        .select('event_id, amount')
        .is('deleted_at', null),
    ]);

    if (eventTypesResult.error) throw eventTypesResult.error;
    if (eventsResult.error) throw eventsResult.error;
    if (expensesResult.error) throw expensesResult.error;

    // Build event counts and expense totals per event type
    const eventsByType = new Map<string, { count: number; eventIds: Set<string> }>();
    for (const event of eventsResult.data || []) {
      if (event.event_type_id) {
        const prev = eventsByType.get(event.event_type_id) || { count: 0, eventIds: new Set() };
        prev.count++;
        prev.eventIds.add(event.id);
        eventsByType.set(event.event_type_id, prev);
      }
    }

    // Sum expenses per event type
    const expensesByType = new Map<string, number>();
    for (const expense of expensesResult.data || []) {
      if (expense.event_id) {
        for (const [typeId, { eventIds }] of eventsByType) {
          if (eventIds.has(expense.event_id)) {
            expensesByType.set(typeId, (expensesByType.get(typeId) || 0) + expense.amount);
          }
        }
      }
    }

    const eventTypes: EventTypeWithTotals[] = (eventTypesResult.data || []).map(et => {
      const stats = eventsByType.get(et.id) || { count: 0 };
      const actualSpent = expensesByType.get(et.id) || 0;
      const budgetAmount = et.budget_amount ?? 0;
      return {
        ...et,
        budget_amount: budgetAmount,
        actual_spent: actualSpent,
        event_count: stats.count,
        remaining: budgetAmount - actualSpent,
      };
    });

    return NextResponse.json({
      event_types: eventTypes,
      meta: {
        total: eventTypes.length,
        filters_applied: filters,
      },
    });
  }
);

// ============================================
// POST /api/event-types
// ============================================

export const POST = withApiHandler({ permission: 'write', resource: 'event-types' },
  async (request: NextRequest) => {
    const body = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!body.fiscal_year_id) {
      return NextResponse.json(
        { error: 'fiscal_year_id is required' },
        { status: 400 }
      );
    }

    if (String(body.name).length > 100) {
      return NextResponse.json(
        { error: 'Name must be 100 characters or fewer' },
        { status: 400 }
      );
    }

    const budgetAmount = parseFloat(body.budget_amount) || 0;
    if (budgetAmount < 0) {
      return NextResponse.json(
        { error: 'Budget amount must be zero or positive' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check for duplicate name in same fiscal year
    // Escape LIKE wildcards (%, _, \) to prevent pattern injection
    const escapedName = body.name.trim().replace(/[%_\\]/g, '\\$&');
    const { data: existing } = await supabase
      .from('event_types')
      .select('id')
      .eq('fiscal_year_id', body.fiscal_year_id)
      .ilike('name', escapedName)
      .eq('is_archived', false);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'An event type with this name already exists' },
        { status: 400 }
      );
    }

    // Get max display_order for this fiscal year
    const { data: maxOrder } = await supabase
      .from('event_types')
      .select('display_order')
      .eq('fiscal_year_id', body.fiscal_year_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const displayOrder = (maxOrder?.[0]?.display_order ?? -1) + 1;

    const { data: newEventType, error: insertError } = await supabase
      .from('event_types')
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        fiscal_year_id: body.fiscal_year_id,
        budget_amount: budgetAmount,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Audit log (non-blocking)
    await auditMutation(request, {
      entity_type: 'event' as AuditEntityType,
      entity_id: newEventType.id,
      action: 'create',
      changes: null,
      metadata: { sub_type: 'event_type' },
    });

    return NextResponse.json({
      ...newEventType,
      actual_spent: 0,
      event_count: 0,
      remaining: newEventType.budget_amount ?? 0,
    }, { status: 201 });
  }
);
