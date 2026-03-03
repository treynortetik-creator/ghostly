/**
 * Ghostly - Bulk Expenses API
 *
 * Endpoints:
 * POST /api/expenses/bulk - Create multiple expenses in one request
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Database, ExpenseSource } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { withIdempotency } from '@/lib/idempotency';
import { logAudit, getActor } from '@/lib/audit';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import {
  isExpenseBudgetBucket,
  isTravelCostType,
  resolveTravelEntryIdForExpense,
  syncTravelBudgetsForPairs,
} from '@/lib/travel-expense-sync';
import { processBudgetTriggerForEvent } from '@/lib/agent/worker';

const MAX_EXPENSES_PER_REQUEST = 100;

interface ExpenseInput {
  amount: unknown;
  expense_date: unknown;
  event_id?: unknown;
  category_id?: unknown;
  budget_bucket?: unknown;
  travel_logistics_entry_id?: unknown;
  travel_cost_type?: unknown;
  vendor?: unknown;
  memo?: unknown;
  source_type?: unknown;
  source_reference?: unknown;
}

interface ItemError {
  index: number;
  errors: string[];
}

type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
type ExpenseInsertWithOrg = ExpenseInsert & { organization_id: string };

/**
 * Validate a single expense item synchronously (field-level checks only).
 * Returns an array of error messages, empty if valid.
 */
function validateExpenseItem(item: ExpenseInput): string[] {
  const errors: string[] = [];

  // Required fields
  if (item.amount === undefined || item.amount === null || item.amount === '') {
    errors.push('Missing required field: amount');
  }
  if (item.expense_date === undefined || item.expense_date === null || item.expense_date === '') {
    errors.push('Missing required field: expense_date');
  }

  // Input lengths
  if (item.vendor && String(item.vendor).length > 200) {
    errors.push('Vendor name must be 200 characters or fewer');
  }
  if (item.memo && String(item.memo).length > 2000) {
    errors.push('Memo must be 2000 characters or fewer');
  }

  // XOR constraint: must have either event_id OR category_id, but not both and not neither
  const eventId = item.event_id ? String(item.event_id).trim() : '';
  const categoryId = item.category_id ? String(item.category_id).trim() : '';
  const hasEventId = eventId.length > 0;
  const hasCategoryId = categoryId.length > 0;

  if (hasEventId && hasCategoryId) {
    errors.push('Expense must be assigned to either an event OR a category, not both.');
  }
  if (!hasEventId && !hasCategoryId) {
    errors.push('Expense must be assigned to either an event or a category.');
  }

  if (item.budget_bucket !== undefined && !isExpenseBudgetBucket(item.budget_bucket)) {
    errors.push('Invalid budget_bucket. Must be one of: event, travel, category');
  }

  const requestedBucket = item.budget_bucket !== undefined ? String(item.budget_bucket) : undefined;
  const budgetBucket = hasCategoryId ? 'category' : (requestedBucket || 'event');

  if (hasCategoryId && requestedBucket !== undefined && requestedBucket !== 'category') {
    errors.push('Category expenses must use budget_bucket="category"');
  }

  if (budgetBucket === 'travel') {
    if (!hasEventId) {
      errors.push('Travel expenses must be assigned to an event.');
    }

    const costType = item.travel_cost_type ? String(item.travel_cost_type).trim() : 'misc';
    if (!isTravelCostType(costType)) {
      errors.push('Invalid travel_cost_type. Must be one of: lodging, airfare, ground_transport, meals, misc');
    }
  } else if (item.travel_logistics_entry_id !== undefined || item.travel_cost_type !== undefined) {
    errors.push('travel_logistics_entry_id and travel_cost_type are only allowed when budget_bucket is "travel".');
  }

  // Amount must be a positive number
  if (item.amount !== undefined && item.amount !== null && item.amount !== '') {
    const amount = parseFloat(String(item.amount));
    if (isNaN(amount) || amount <= 0) {
      errors.push('Invalid amount. Must be a positive number');
    }
  }

  // source_type validation
  const validSourceTypes: ExpenseSource[] = ['manual', 'brex', 'pdf'];
  const sourceType = item.source_type || 'manual';
  if (!validSourceTypes.includes(sourceType as ExpenseSource)) {
    errors.push('Invalid source_type. Must be one of: manual, brex, pdf');
  }

  // expense_date format
  if (item.expense_date !== undefined && item.expense_date !== null && item.expense_date !== '') {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(String(item.expense_date))) {
      errors.push('Invalid expense_date format. Use YYYY-MM-DD');
    }
  }

  return errors;
}

// ============================================
// POST /api/expenses/bulk
// ============================================

export const POST = withIdempotency(withApiHandler({ permission: 'write', resource: 'expenses/bulk' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    // Validate top-level structure
    if (!body.expenses || !Array.isArray(body.expenses)) {
      return NextResponse.json(
        { error: 'Request body must contain an "expenses" array' },
        { status: 400 }
      );
    }

    if (body.expenses.length === 0) {
      return NextResponse.json(
        { error: 'Expenses array must not be empty' },
        { status: 400 }
      );
    }

    if (body.expenses.length > MAX_EXPENSES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_EXPENSES_PER_REQUEST} expenses per request` },
        { status: 400 }
      );
    }

    // Phase 1: Validate all items synchronously (field-level)
    const itemErrors: ItemError[] = [];
    for (let i = 0; i < body.expenses.length; i++) {
      const errors = validateExpenseItem(body.expenses[i]);
      if (errors.length > 0) {
        itemErrors.push({ index: i, errors });
      }
    }

    if (itemErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: itemErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Phase 2: Collect unique event_ids and category_ids for batch validation
    const eventIds = new Set<string>();
    const categoryIds = new Set<string>();

    for (const item of body.expenses) {
      if (item.event_id && item.event_id !== '') {
        eventIds.add(item.event_id);
      }
      if (item.category_id && item.category_id !== '') {
        categoryIds.add(item.category_id);
      }
    }

    // Validate all referenced events exist (scoped to org)
    const validEvents = new Map<string, string>(); // id -> name
    if (eventIds.size > 0) {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, name')
        .in('id', [...eventIds])
        .eq('organization_id', orgId)
        .is('deleted_at', null);

      if (eventsError) {
        throw eventsError;
      }

      for (const event of events || []) {
        validEvents.set(event.id, event.name);
      }
    }

    // Validate all referenced categories exist (scoped to org)
    const validCategories = new Map<string, string>(); // id -> name
    if (categoryIds.size > 0) {
      const { data: categories, error: categoriesError } = await supabase
        .from('budget_categories')
        .select('id, name')
        .in('id', [...categoryIds])
        .eq('organization_id', orgId)
        .is('deleted_at', null);

      if (categoriesError) {
        throw categoriesError;
      }

      for (const category of categories || []) {
        validCategories.set(category.id, category.name);
      }
    }

    // Check for missing events/categories
    const refErrors: ItemError[] = [];
    for (let i = 0; i < body.expenses.length; i++) {
      const item = body.expenses[i];
      const errors: string[] = [];

      if (item.event_id && item.event_id !== '' && !validEvents.has(item.event_id)) {
        errors.push('Event not found');
      }
      if (item.category_id && item.category_id !== '' && !validCategories.has(item.category_id)) {
        errors.push('Category not found');
      }

      if (errors.length > 0) {
        refErrors.push({ index: i, errors });
      }
    }

    if (refErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: refErrors },
        { status: 400 }
      );
    }

    // Phase 3: Build insert rows
    const insertRows: ExpenseInsertWithOrg[] = [];
    const syncPairs: Array<{ entryId?: string | null; costType?: string | null }> = [];

    for (let i = 0; i < (body.expenses as ExpenseInput[]).length; i++) {
      const item = (body.expenses as ExpenseInput[])[i];
      const eventId = item.event_id ? String(item.event_id).trim() : '';
      const categoryId = item.category_id ? String(item.category_id).trim() : '';
      const hasEventId = eventId.length > 0;
      const hasCategoryId = categoryId.length > 0;
      const requestedBucket = item.budget_bucket !== undefined ? String(item.budget_bucket) : undefined;
      const budgetBucket = hasCategoryId ? 'category' : (requestedBucket || 'event');

      let travelLogisticsEntryId: string | null = null;
      let travelCostType: string | null = null;

      if (budgetBucket === 'travel') {
        travelCostType = item.travel_cost_type ? String(item.travel_cost_type).trim() : 'misc';
        try {
          travelLogisticsEntryId = await resolveTravelEntryIdForExpense(
            supabase,
            orgId,
            eventId,
            item.travel_logistics_entry_id ? String(item.travel_logistics_entry_id) : null
          );
        } catch (error) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: [{ index: i, errors: [error instanceof Error ? error.message : 'Invalid travel logistics assignment'] }],
            },
            { status: 400 }
          );
        }
        syncPairs.push({ entryId: travelLogisticsEntryId, costType: travelCostType });
      }

      const vendor = item.vendor !== undefined && item.vendor !== null && String(item.vendor).trim() !== ''
        ? String(item.vendor).trim()
        : null;
      const memo = item.memo !== undefined && item.memo !== null && String(item.memo).trim() !== ''
        ? String(item.memo).trim()
        : null;
      const sourceReference = item.source_reference !== undefined && item.source_reference !== null && String(item.source_reference).trim() !== ''
        ? String(item.source_reference).trim()
        : null;

      insertRows.push({
        organization_id: orgId,
        event_id: hasEventId ? eventId : null,
        category_id: hasCategoryId ? categoryId : null,
        amount: parseFloat(String(item.amount)),
        expense_date: String(item.expense_date),
        vendor,
        memo,
        source_type: (item.source_type || 'manual') as ExpenseSource,
        source_reference: sourceReference,
        budget_bucket: budgetBucket,
        travel_logistics_entry_id: travelLogisticsEntryId,
        travel_cost_type: travelCostType,
        is_duplicate: false,
      });
    }

    // Bulk insert
    const { data: newExpenses, error: insertError } = await supabase
      .from('expenses')
      .insert(insertRows as unknown as ExpenseInsert[])
      .select();

    if (insertError || !newExpenses) {
      throw insertError || new Error('Failed to insert expenses');
    }

    await syncTravelBudgetsForPairs(supabase, syncPairs);

    const eventIdsToCheck = new Set(
      (newExpenses || [])
        .map((expense) => expense.event_id)
        .filter((eventId): eventId is string => typeof eventId === 'string' && eventId.length > 0)
    );
    for (const eventId of eventIdsToCheck) {
      processBudgetTriggerForEvent(orgId, eventId).catch(() => {});
    }

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      for (const expense of newExpenses) {
        logAudit({
          entity_type: 'expense',
          entity_id: expense.id,
          action: 'create',
          changes: null,
          actor,
          actor_type,
        });
      }
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    // Build response with relation fields
    const expenses = newExpenses.map(expense => {
      const eventName = expense.event_id ? (validEvents.get(expense.event_id) ?? null) : null;
      const categoryName = expense.category_id ? (validCategories.get(expense.category_id) ?? null) : null;

      return {
        ...expense,
        event_name: eventName,
        category_name: categoryName,
        target_type: expense.event_id ? 'event' as const : 'category' as const,
        target_name: eventName || categoryName || 'Unknown',
      };
    });

    return NextResponse.json(
      {
        expenses,
        meta: {
          total: expenses.length,
          created: expenses.length,
        },
      },
      { status: 201 }
    );
  }
));
