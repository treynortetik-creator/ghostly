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
    const modifiedAfter = searchParams.get('modified_after');
    const idsParam = searchParams.get('ids');
    const sortBy = searchParams.get('sort_by') || 'date'; // date, amount, vendor
    const sortOrder = searchParams.get('sort_order') || 'desc'; // asc, desc

    // Parse pagination parameters
    const page = Math.min(10000, Math.max(1, parseInt(searchParams.get('page') || '1', 10)));
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

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
    if (filters.modified_after) sumQuery = sumQuery.gt('updated_at', filters.modified_after);
    if (filters.ids) sumQuery = sumQuery.in('id', filters.ids);

    const { data: allAmounts } = await sumQuery;
    const totalAmount = (allAmounts || []).reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

    // Map results to add relation fields
    const expenses = (rawExpenses || []).map(e => {
      const { events: eventRel, budget_categories: catRel, ...rest } = e as any;
      return {
        ...rest,
        event_name: eventRel?.name || null,
        category_name: catRel?.name || null,
        target_type: rest.event_id ? 'event' as const : 'category' as const,
        target_name: eventRel?.name || catRel?.name || 'Unknown',
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
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
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
    if (body.vendor && String(body.vendor).length > 200) {
      return NextResponse.json(
        { error: 'Vendor name must be 200 characters or fewer' },
        { status: 400 }
      );
    }
    if (body.memo && String(body.memo).length > 2000) {
      return NextResponse.json(
        { error: 'Memo must be 2000 characters or fewer' },
        { status: 400 }
      );
    }

    // Validate XOR constraint: must have either event_id OR category_id, but not both and not neither
    const hasEventId = body.event_id && body.event_id !== '';
    const hasCategoryId = body.category_id && body.category_id !== '';

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

    // Validate amount is a positive number
    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a positive number' },
        { status: 400 }
      );
    }

    // Validate source_type
    const validSourceTypes: ExpenseSource[] = ['manual', 'brex', 'pdf'];
    const sourceType = body.source_type || 'manual';
    if (!validSourceTypes.includes(sourceType)) {
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
    if (hasEventId) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name')
        .eq('id', body.event_id)
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
    }

    // Validate category_id exists if provided
    let categoryName: string | null = null;
    if (hasCategoryId) {
      const { data: category, error: categoryError } = await supabase
        .from('budget_categories')
        .select('id, name')
        .eq('id', body.category_id)
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

    // Insert expense into Supabase
    const { data: newExpense, error: insertError } = await supabase
      .from('expenses')
      .insert({
        organization_id: orgId,
        event_id: hasEventId ? body.event_id : null,
        category_id: hasCategoryId ? body.category_id : null,
        amount: amount,
        expense_date: body.expense_date,
        vendor: body.vendor || null,
        memo: body.memo || null,
        source_type: sourceType as ExpenseSource,
        source_reference: body.source_reference || null,
        is_duplicate: false,
      })
      .select()
      .single();

    if (insertError || !newExpense) {
      throw insertError || new Error('Failed to insert expense');
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

    return NextResponse.json(response, { status: 201 });
  }
));
