/**
 * Ghostly - Single Expense API
 *
 * Endpoints:
 * GET /api/expenses/[id] - Get a single expense
 * PUT /api/expenses/[id] - Update an expense
 * DELETE /api/expenses/[id] - Soft delete an expense
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ExpenseSource } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { computeChanges } from '@/lib/audit';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import {
  isExpenseBudgetBucket,
  isTravelCostType,
  resolveTravelEntryIdForExpense,
  syncTravelBudgetsForPairs,
} from '@/lib/travel-expense-sync';
import { processBudgetTriggerForEvent } from '@/lib/agent/worker';

type RouteContext = { params: Promise<{ id: string }> };

type NameRelation = { name: string } | { name: string }[] | null;

function relationName(value: NameRelation): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value[0]?.name || null;
  }
  return value.name || null;
}

function toNameRelation(value: unknown): NameRelation {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === 'object' && 'name' in first) {
      const name = (first as { name?: unknown }).name;
      if (typeof name === 'string') {
        return [{ name }];
      }
    }
    return null;
  }
  if (typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string') {
      return { name };
    }
  }
  return null;
}

// ============================================
// GET /api/expenses/[id]
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'expenses/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data: expense, error } = await supabase
      .from('expenses')
      .select('*, events(name), budget_categories(name)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error?.code === 'PGRST116' || !expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    if (error) throw error;

    // Map joined relations to flat fields
    const expenseRecord = expense as unknown as Record<string, unknown>;
    const { events: eventUnknown, budget_categories: catUnknown, ...rest } = expenseRecord;
    const eventRel = toNameRelation(eventUnknown);
    const catRel = toNameRelation(catUnknown);
    const hasEventTarget = typeof rest.event_id === 'string' && rest.event_id.length > 0;
    const mapped = {
      ...rest,
      event_name: relationName(eventRel),
      category_name: relationName(catRel),
      target_type: hasEventTarget ? 'event' as const : 'category' as const,
      target_name: relationName(eventRel) || relationName(catRel) || 'Unknown',
    };

    return NextResponse.json({ expense: mapped });
  }
);

// ============================================
// PUT /api/expenses/[id]
// ============================================

export const PUT = withApiHandler({ permission: 'write', resource: 'expenses/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    // Check if expense exists
    const { data: existingExpense, error: findError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (findError?.code === 'PGRST116' || !existingExpense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    if (findError) throw findError;

    // Determine new event_id and category_id values
    const newEventId = body.event_id !== undefined
      ? (body.event_id ? String(body.event_id).trim() : '')
      : existingExpense.event_id;
    const newCategoryId = body.category_id !== undefined
      ? (body.category_id ? String(body.category_id).trim() : '')
      : existingExpense.category_id;

    // Validate XOR constraint if either is being changed
    const hasEventId = newEventId && newEventId !== '';
    const hasCategoryId = newCategoryId && newCategoryId !== '';

    if (hasEventId && hasCategoryId) {
      return NextResponse.json(
        { error: 'Expense must be assigned to either an event OR a category, not both.' },
        { status: 400 }
      );
    }

    if (!hasEventId && !hasCategoryId) {
      return NextResponse.json(
        { error: 'Expense must be assigned to either an event or a category.' },
        { status: 400 }
      );
    }

    // Validate and normalize budget bucket
    const requestedBudgetBucket = body.budget_bucket !== undefined
      ? String(body.budget_bucket)
      : (existingExpense.budget_bucket || (hasCategoryId ? 'category' : 'event'));

    if (!isExpenseBudgetBucket(requestedBudgetBucket)) {
      return NextResponse.json(
        { error: 'Invalid budget_bucket. Must be one of: event, travel, category' },
        { status: 400 }
      );
    }

    const budgetBucket = hasCategoryId ? 'category' : requestedBudgetBucket;

    if (hasCategoryId && requestedBudgetBucket !== 'category') {
      return NextResponse.json(
        { error: 'Category expenses must use budget_bucket="category"' },
        { status: 400 }
      );
    }

    if (budgetBucket === 'travel' && !hasEventId) {
      return NextResponse.json(
        { error: 'Travel expenses must be assigned to an event.' },
        { status: 400 }
      );
    }

    // Validate event_id exists if provided
    if (hasEventId) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name')
        .eq('id', newEventId)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .single();

      if (eventError || !event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 400 }
        );
      }
    }

    // Validate category_id exists if provided
    if (hasCategoryId) {
      const { data: category, error: categoryError } = await supabase
        .from('budget_categories')
        .select('id, name')
        .eq('id', newCategoryId)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .single();

      if (categoryError || !category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 400 }
        );
      }
    }

    // Validate/resolve travel linkage
    let travelLogisticsEntryId: string | null = null;
    let travelCostType: string | null = null;
    if (budgetBucket === 'travel') {
      const requestedCostType = body.travel_cost_type !== undefined
        ? String(body.travel_cost_type).trim()
        : (existingExpense.travel_cost_type || 'misc');

      if (!isTravelCostType(requestedCostType)) {
        return NextResponse.json(
          { error: 'Invalid travel_cost_type. Must be one of: lodging, airfare, ground_transport, meals, misc' },
          { status: 400 }
        );
      }

      travelCostType = requestedCostType;
      const requestedEntryId = body.travel_logistics_entry_id !== undefined
        ? (body.travel_logistics_entry_id ? String(body.travel_logistics_entry_id).trim() : null)
        : (existingExpense.travel_logistics_entry_id || null);

      try {
        travelLogisticsEntryId = await resolveTravelEntryIdForExpense(
          supabase,
          orgId,
          String(newEventId),
          requestedEntryId
        );
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid travel logistics assignment' },
          { status: 400 }
        );
      }
    } else if (body.travel_logistics_entry_id !== undefined || body.travel_cost_type !== undefined) {
      return NextResponse.json(
        { error: 'travel_logistics_entry_id and travel_cost_type are only allowed when budget_bucket is "travel".' },
        { status: 400 }
      );
    }

    // Validate amount if provided
    if (body.amount !== undefined) {
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'Invalid amount. Must be a positive number' },
          { status: 400 }
        );
      }
    }

    // Validate source_type if provided
    if (body.source_type !== undefined) {
      const validSourceTypes: ExpenseSource[] = ['manual', 'brex', 'pdf'];
      if (!validSourceTypes.includes(body.source_type)) {
        return NextResponse.json(
          { error: 'Invalid source_type. Must be one of: manual, brex, pdf' },
          { status: 400 }
        );
      }
    }

    // Validate expense_date format if provided
    if (body.expense_date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.expense_date)) {
        return NextResponse.json(
          { error: 'Invalid expense_date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      event_id: hasEventId ? newEventId : null,
      category_id: hasCategoryId ? newCategoryId : null,
      budget_bucket: budgetBucket,
      travel_logistics_entry_id: travelLogisticsEntryId,
      travel_cost_type: travelCostType,
    };

    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
    if (body.expense_date !== undefined) updateData.expense_date = body.expense_date;
    if (body.vendor !== undefined) updateData.vendor = body.vendor;
    if (body.memo !== undefined) updateData.memo = body.memo;
    if (body.source_type !== undefined) updateData.source_type = body.source_type;
    if (body.source_reference !== undefined) updateData.source_reference = body.source_reference;

    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .select('*, events(name), budget_categories(name)')
      .single();

    if (updateError) throw updateError;

    await syncTravelBudgetsForPairs(supabase, [
      {
        entryId: existingExpense.budget_bucket === 'travel' ? existingExpense.travel_logistics_entry_id : null,
        costType: existingExpense.budget_bucket === 'travel' ? existingExpense.travel_cost_type : null,
      },
      { entryId: travelLogisticsEntryId, costType: travelCostType },
    ]);

    // Map joined relations to flat fields
    const updatedExpenseRecord = updatedExpense as unknown as Record<string, unknown>;
    const { events: eventUnknown, budget_categories: catUnknown, ...rest } = updatedExpenseRecord;
    const eventRel = toNameRelation(eventUnknown);
    const catRel = toNameRelation(catUnknown);
    const hasEventTarget = typeof rest.event_id === 'string' && rest.event_id.length > 0;
    const mapped = {
      ...rest,
      event_name: relationName(eventRel),
      category_name: relationName(catRel),
      target_type: hasEventTarget ? 'event' as const : 'category' as const,
      target_name: relationName(eventRel) || relationName(catRel) || 'Unknown',
    };

    // Audit log (non-blocking)
    const auditFields = [
      'amount',
      'expense_date',
      'vendor',
      'memo',
      'event_id',
      'category_id',
      'budget_bucket',
      'travel_logistics_entry_id',
      'travel_cost_type',
      'source_type',
      'source_reference',
    ];
    const changes = computeChanges(existingExpense as Record<string, unknown>, updatedExpense as Record<string, unknown>, auditFields);
    await auditMutation(request, {
      entity_type: 'expense',
      entity_id: id,
      action: 'update',
      changes,
    });

    if (existingExpense.event_id) {
      processBudgetTriggerForEvent(orgId, existingExpense.event_id).catch((err) => console.error('Budget trigger failed for event:', existingExpense.event_id, err));
    }
    if (hasEventId && String(newEventId) !== String(existingExpense.event_id || '')) {
      processBudgetTriggerForEvent(orgId, String(newEventId)).catch((err) => console.error('Budget trigger failed for event:', newEventId, err));
    }

    return NextResponse.json({ expense: mapped });
  }
);

// ============================================
// DELETE /api/expenses/[id]
// ============================================

export const DELETE = withApiHandler({ permission: 'write', resource: 'expenses/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    // Check if expense exists
    const { data: existingExpense, error: findError } = await supabase
      .from('expenses')
      .select('id, event_id, budget_bucket, travel_logistics_entry_id, travel_cost_type')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (findError?.code === 'PGRST116' || !existingExpense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    if (findError) throw findError;

    // Soft delete
    const { error: deleteError } = await supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', orgId);

    if (deleteError) throw deleteError;

    await syncTravelBudgetsForPairs(supabase, [
      {
        entryId: existingExpense.budget_bucket === 'travel' ? existingExpense.travel_logistics_entry_id : null,
        costType: existingExpense.budget_bucket === 'travel' ? existingExpense.travel_cost_type : null,
      },
    ]);

    // Audit log (non-blocking)
    await auditMutation(request, {
      entity_type: 'expense',
      entity_id: id,
      action: 'delete',
      changes: null,
    });

    if (existingExpense.event_id) {
      processBudgetTriggerForEvent(orgId, existingExpense.event_id).catch((err) => console.error('Budget trigger failed for event:', existingExpense.event_id, err));
    }

    return NextResponse.json({
      message: 'Expense deleted successfully',
      id,
    });
  }
);
