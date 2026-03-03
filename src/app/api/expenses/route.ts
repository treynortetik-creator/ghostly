/**
 * Ghostly - Expenses API
 *
 * Endpoints:
 * GET /api/expenses - List all expenses with optional filters
 * POST /api/expenses - Create a new expense
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ExpenseSource } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { withIdempotency } from '@/lib/idempotency';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import { parsePagination, paginationMeta, paginationRange } from '@/lib/pagination';
import { VALIDATION, VALID_EXPENSE_SOURCE_TYPES } from '@/lib/validation';
import {
  isExpenseBudgetBucket,
  isTravelCostType,
  resolveTravelEntryIdForExpense,
  syncTravelBudgetsForPairs,
} from '@/lib/travel-expense-sync';
import { processBudgetTriggerForEvent } from '@/lib/agent/worker';

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
// GET /api/expenses
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'expenses' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const eventId = searchParams.get('event_id');
    const categoryId = searchParams.get('category_id');
    const fiscalYearId = searchParams.get('fiscal_year_id');
    const dateStart = searchParams.get('date_start');
    const dateEnd = searchParams.get('date_end');
    const vendor = searchParams.get('vendor');
    const sourceType = searchParams.get('source_type') as ExpenseSource | null;
    const budgetBucket = searchParams.get('budget_bucket');
    const travelLogisticsEntryId = searchParams.get('travel_logistics_entry_id');
    const travelCostType = searchParams.get('travel_cost_type');
    const modifiedAfter = searchParams.get('modified_after');
    const idsParam = searchParams.get('ids');
    const sortBy = searchParams.get('sort_by') || 'date'; // date, amount, vendor
    const sortOrder = searchParams.get('sort_order') || 'desc'; // asc, desc

    // Parse pagination parameters
    const pagination = parsePagination(searchParams);
    const { page } = pagination;
    const { from, to } = paginationRange(pagination);

    // Validate modified_after if provided
    if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }

    // Build filters object for meta response
    const filters: {
      event_id?: string;
      category_id?: string;
      fiscal_year_id?: string;
      date_start?: string;
      date_end?: string;
      vendor?: string;
      source_type?: ExpenseSource;
      budget_bucket?: string;
      travel_logistics_entry_id?: string;
      travel_cost_type?: string;
      modified_after?: string;
      ids?: string[];
    } = {};

    if (eventId) {
      filters.event_id = eventId;
    }
    if (categoryId) {
      filters.category_id = categoryId;
    }
    if (fiscalYearId) {
      filters.fiscal_year_id = fiscalYearId;
    }
    if (dateStart) {
      filters.date_start = dateStart;
    }
    if (dateEnd) {
      filters.date_end = dateEnd;
    }
    if (vendor && vendor.length <= 200) {
      filters.vendor = vendor;
    }
    if (sourceType && ['manual', 'brex', 'pdf'].includes(sourceType)) {
      filters.source_type = sourceType;
    }
    if (budgetBucket && isExpenseBudgetBucket(budgetBucket)) {
      filters.budget_bucket = budgetBucket;
    }
    if (travelLogisticsEntryId) {
      filters.travel_logistics_entry_id = travelLogisticsEntryId;
    }
    if (travelCostType && isTravelCostType(travelCostType)) {
      filters.travel_cost_type = travelCostType;
    }
    if (modifiedAfter) {
      filters.modified_after = modifiedAfter;
    }
    if (idsParam) {
      filters.ids = idsParam.split(',');
    }

    const supabase = await createClient();

    // If fiscal year filter is specified, look up valid event/category IDs
    let fiscalEventIds: Set<string> | null = null;
    let fiscalCategoryIds: Set<string> | null = null;

    if (filters.fiscal_year_id) {
      const [{ data: fyEvents }, { data: fyCategories }] = await Promise.all([
        supabase.from('events').select('id').eq('fiscal_year_id', filters.fiscal_year_id).eq('organization_id', orgId).is('deleted_at', null),
        supabase.from('budget_categories').select('id').eq('fiscal_year_id', filters.fiscal_year_id).eq('organization_id', orgId).is('deleted_at', null),
      ]);
      fiscalEventIds = new Set((fyEvents ?? []).map(e => e.id));
      fiscalCategoryIds = new Set((fyCategories ?? []).map(c => c.id));
    }

    // Build query with joined relations
    let query = supabase
      .from('expenses')
      .select('*, events(name), budget_categories(name)', { count: 'exact' })
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    // Apply filters
    if (filters.event_id) {
      query = query.eq('event_id', filters.event_id);
    }
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    // Apply fiscal year filter via event/category ID lists
    if (fiscalEventIds && fiscalCategoryIds) {
      const allIds = [...fiscalEventIds, ...fiscalCategoryIds];
      if (allIds.length === 0) {
        // No events or categories in this fiscal year — return empty
        return NextResponse.json({
          expenses: [],
          meta: {
            total: 0,
            total_amount: 0,
            filters_applied: filters,
            sort: { by: sortBy, order: sortOrder },
          },
        });
      }
      // Filter: event_id in fiscal events OR category_id in fiscal categories
      query = query.or(
        `event_id.in.(${[...fiscalEventIds].join(',')}),category_id.in.(${[...fiscalCategoryIds].join(',')})`
      );
    }

    if (filters.date_start) {
      query = query.gte('expense_date', filters.date_start);
    }
    if (filters.date_end) {
      query = query.lte('expense_date', filters.date_end);
    }
    if (filters.vendor) {
      // Escape LIKE special characters to prevent wildcard injection
      const escapedVendor = filters.vendor.replace(/[%_\\]/g, '\\$&');
      query = query.ilike('vendor', `%${escapedVendor}%`);
    }
    if (filters.source_type) {
      query = query.eq('source_type', filters.source_type);
    }
    if (filters.budget_bucket) {
      query = query.eq('budget_bucket', filters.budget_bucket);
    }
    if (filters.travel_logistics_entry_id) {
      query = query.eq('travel_logistics_entry_id', filters.travel_logistics_entry_id);
    }
    if (filters.travel_cost_type) {
      query = query.eq('travel_cost_type', filters.travel_cost_type);
    }
    if (filters.modified_after) {
      query = query.gt('updated_at', filters.modified_after);
    }
    if (filters.ids) {
      query = query.in('id', filters.ids);
    }

    // Map sortBy param to actual column name
    const sortColumnMap: Record<string, string> = {
      date: 'expense_date',
      amount: 'amount',
      vendor: 'vendor',
    };
    const sortColumn = sortColumnMap[sortBy] || 'expense_date';
    const ascending = sortOrder === 'asc';

    query = query.order(sortColumn, { ascending });
    query = query.range(from, to);

    const { data: rawExpenses, error, count: totalCount } = await query;

    if (error) {
      throw error;
    }

    // Get total amount across ALL matching expenses (not just current page)
    let sumQuery = supabase
      .from('expenses')
      .select('amount')
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    if (filters.event_id) sumQuery = sumQuery.eq('event_id', filters.event_id);
    if (filters.category_id) sumQuery = sumQuery.eq('category_id', filters.category_id);
    if (fiscalEventIds && fiscalCategoryIds) {
      const allIds = [...fiscalEventIds, ...fiscalCategoryIds];
      if (allIds.length > 0) {
        sumQuery = sumQuery.or(
          `event_id.in.(${[...fiscalEventIds].join(',')}),category_id.in.(${[...fiscalCategoryIds].join(',')})`
        );
      }
    }
    if (filters.date_start) sumQuery = sumQuery.gte('expense_date', filters.date_start);
    if (filters.date_end) sumQuery = sumQuery.lte('expense_date', filters.date_end);
    if (filters.vendor) {
      const escapedVendor = filters.vendor.replace(/[%_\\]/g, '\\$&');
      sumQuery = sumQuery.ilike('vendor', `%${escapedVendor}%`);
    }
    if (filters.source_type) sumQuery = sumQuery.eq('source_type', filters.source_type);
    if (filters.budget_bucket) sumQuery = sumQuery.eq('budget_bucket', filters.budget_bucket);
    if (filters.travel_logistics_entry_id) sumQuery = sumQuery.eq('travel_logistics_entry_id', filters.travel_logistics_entry_id);
    if (filters.travel_cost_type) sumQuery = sumQuery.eq('travel_cost_type', filters.travel_cost_type);
    if (filters.modified_after) sumQuery = sumQuery.gt('updated_at', filters.modified_after);
    if (filters.ids) sumQuery = sumQuery.in('id', filters.ids);

    const { data: allAmounts } = await sumQuery;
    const totalAmount = (allAmounts || []).reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

    // Map results to add relation fields
    const expenses = (rawExpenses || []).map(e => {
      const row = e as unknown as Record<string, unknown>;
      const { events: eventUnknown, budget_categories: catUnknown, ...rest } = row;
      const eventRel = toNameRelation(eventUnknown);
      const catRel = toNameRelation(catUnknown);
      const hasEventTarget = typeof rest.event_id === 'string' && rest.event_id.length > 0;
      return {
        ...rest,
        event_name: relationName(eventRel),
        category_name: relationName(catRel),
        target_type: hasEventTarget ? 'event' as const : 'category' as const,
        target_name: relationName(eventRel) || relationName(catRel) || 'Unknown',
      };
    });

    const total = totalCount ?? expenses.length;

    return NextResponse.json({
      expenses,
      meta: {
        total,
        total_amount: totalAmount,
        filters_applied: filters,
        sort: { by: sortBy, order: sortOrder },
      },
      pagination: paginationMeta(total, pagination),
    });
  }
);

// ============================================
// POST /api/expenses
// ============================================

export const POST = withIdempotency(withApiHandler({ permission: 'write', resource: 'expenses' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['amount', 'expense_date'];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate input lengths
    if (body.vendor && String(body.vendor).length > VALIDATION.VENDOR_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Vendor name must be ${VALIDATION.VENDOR_MAX_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }
    if (body.memo && String(body.memo).length > VALIDATION.MEMO_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Memo must be ${VALIDATION.MEMO_MAX_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    // Validate XOR constraint: must have either event_id OR category_id, but not both and not neither
    const eventId = body.event_id ? String(body.event_id).trim() : '';
    const categoryId = body.category_id ? String(body.category_id).trim() : '';
    const hasEventId = eventId.length > 0;
    const hasCategoryId = categoryId.length > 0;

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
    const requestedBucket = body.budget_bucket;
    if (requestedBucket !== undefined && !isExpenseBudgetBucket(requestedBucket)) {
      return NextResponse.json(
        { error: 'Invalid budget_bucket. Must be one of: event, travel, category' },
        { status: 400 }
      );
    }

    const budgetBucket = hasCategoryId
      ? 'category'
      : ((requestedBucket as string | undefined) ?? 'event');

    if (hasCategoryId && requestedBucket !== undefined && requestedBucket !== 'category') {
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

    // Validate amount is a positive number
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a positive number' },
        { status: 400 }
      );
    }

    // Validate source_type
    const sourceType = body.source_type || 'manual';
    if (!VALID_EXPENSE_SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: 'Invalid source_type. Must be one of: manual, brex, pdf' },
        { status: 400 }
      );
    }

    // Validate expense_date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.expense_date)) {
      return NextResponse.json(
        { error: 'Invalid expense_date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Validate event_id exists if provided
    let eventName: string | null = null;
    let eventDate: string | null = null;
    if (hasEventId) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name, date_start')
        .eq('id', eventId)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .single();

      if (eventError || !event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 400 }
        );
      }
      eventName = event.name;
      eventDate = event.date_start;
    }

    // Validate category_id exists if provided
    let categoryName: string | null = null;
    if (hasCategoryId) {
      const { data: category, error: categoryError } = await supabase
        .from('budget_categories')
        .select('id, name')
        .eq('id', categoryId)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .single();

      if (categoryError || !category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 400 }
        );
      }
      categoryName = category.name;
    }

    // Validate/resolve travel linkage
    let travelLogisticsEntryId: string | null = null;
    let travelCostType: string | null = null;
    if (budgetBucket === 'travel') {
      const requestedCostType = body.travel_cost_type ? String(body.travel_cost_type).trim() : 'misc';
      if (!isTravelCostType(requestedCostType)) {
        return NextResponse.json(
          { error: 'Invalid travel_cost_type. Must be one of: lodging, airfare, ground_transport, meals, misc' },
          { status: 400 }
        );
      }

      travelCostType = requestedCostType;
      try {
        travelLogisticsEntryId = await resolveTravelEntryIdForExpense(
          supabase,
          orgId,
          eventId,
          body.travel_logistics_entry_id ? String(body.travel_logistics_entry_id) : null
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

    // Insert expense into Supabase
    const { data: newExpense, error: insertError } = await supabase
      .from('expenses')
      .insert({
        organization_id: orgId,
        event_id: hasEventId ? eventId : null,
        category_id: hasCategoryId ? categoryId : null,
        amount: amount,
        expense_date: body.expense_date || eventDate || new Date().toISOString().slice(0, 10),
        vendor: body.vendor || null,
        memo: body.memo || null,
        source_type: sourceType as ExpenseSource,
        source_reference: body.source_reference || null,
        budget_bucket: budgetBucket,
        travel_logistics_entry_id: travelLogisticsEntryId,
        travel_cost_type: travelCostType,
        is_duplicate: false,
      })
      .select()
      .single();

    if (insertError || !newExpense) {
      throw insertError || new Error('Failed to insert expense');
    }

    if (budgetBucket === 'travel' && travelLogisticsEntryId && travelCostType) {
      await syncTravelBudgetsForPairs(supabase, [
        { entryId: travelLogisticsEntryId, costType: travelCostType },
      ]);
    }

    // Build the response with relation fields
    const response = {
      ...newExpense,
      event_name: eventName,
      category_name: categoryName,
      target_type: hasEventId ? 'event' as const : 'category' as const,
      target_name: eventName || categoryName || 'Unknown',
    };

    // Audit log (non-blocking)
    await auditMutation(request, {
      entity_type: 'expense',
      entity_id: newExpense.id,
      action: 'create',
      changes: null,
    });

    if (hasEventId) {
      processBudgetTriggerForEvent(orgId, eventId).catch(() => {});
    }

    return NextResponse.json(response, { status: 201 });
  }
));
