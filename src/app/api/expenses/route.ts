/**
 * The Counting House - Expenses API
 *
 * Endpoints:
 * GET /api/expenses - List all expenses with optional filters
 * POST /api/expenses - Create a new expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-logger';
import type { ExpenseSource } from '@/types/database';
import { createClient } from '@/lib/supabase/server';

// ============================================
// GET /api/expenses
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const eventId = searchParams.get('event_id');
    const categoryId = searchParams.get('category_id');
    const dateStart = searchParams.get('date_start');
    const dateEnd = searchParams.get('date_end');
    const vendor = searchParams.get('vendor');
    const sourceType = searchParams.get('source_type') as ExpenseSource | null;
    const sortBy = searchParams.get('sort_by') || 'date'; // date, amount, vendor
    const sortOrder = searchParams.get('sort_order') || 'desc'; // asc, desc

    // Build filters object for meta response
    const filters: {
      event_id?: string;
      category_id?: string;
      date_start?: string;
      date_end?: string;
      vendor?: string;
      source_type?: ExpenseSource;
    } = {};

    if (eventId) {
      filters.event_id = eventId;
    }
    if (categoryId) {
      filters.category_id = categoryId;
    }
    if (dateStart) {
      filters.date_start = dateStart;
    }
    if (dateEnd) {
      filters.date_end = dateEnd;
    }
    if (vendor) {
      filters.vendor = vendor;
    }
    if (sourceType && ['manual', 'brex', 'pdf'].includes(sourceType)) {
      filters.source_type = sourceType;
    }

    const supabase = await createClient();

    // Build query with joined relations
    let query = supabase
      .from('expenses')
      .select('*, events(name), budget_categories(name)')
      .is('deleted_at', null);

    // Apply filters
    if (filters.event_id) {
      query = query.eq('event_id', filters.event_id);
    }
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }
    if (filters.date_start) {
      query = query.gte('expense_date', filters.date_start);
    }
    if (filters.date_end) {
      query = query.lte('expense_date', filters.date_end);
    }
    if (filters.vendor) {
      query = query.ilike('vendor', `%${filters.vendor}%`);
    }
    if (filters.source_type) {
      query = query.eq('source_type', filters.source_type);
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

    const { data: rawExpenses, error } = await query;

    if (error) {
      throw error;
    }

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

    // Calculate totals
    const totalAmount = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);

    return NextResponse.json({
      expenses,
      meta: {
        total: expenses.length,
        total_amount: totalAmount,
        filters_applied: filters,
        sort: { by: sortBy, order: sortOrder },
      },
    });
  } catch (err) {
    console.error('Expenses API error:', err);
    logError('Failed to fetch expenses', { error: err as Error, source: 'api/expenses', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/expenses
// ============================================

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error('Create expense error:', err);
    logError('Failed to create expense', { error: err as Error, source: 'api/expenses', context: { method: 'POST' } });
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    );
  }
}
