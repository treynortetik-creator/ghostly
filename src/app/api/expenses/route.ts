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
import {
  getExpenses,
  allExpenses,
  type ExpenseWithRelations,
} from '@/lib/mock-data/expenses';
import { getEventById } from '@/lib/mock-data/events';
import { getCategoryById } from '@/lib/mock-data/categories';

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

    // Build filters object
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

    // TODO: Replace with real Supabase queries when connected
    // const supabase = await createClient();
    // let query = supabase.from('expenses').select('*, events(*), budget_categories(*)').is('deleted_at', null);
    // if (filters.event_id) query = query.eq('event_id', filters.event_id);
    // if (filters.category_id) query = query.eq('category_id', filters.category_id);
    // etc...

    let expenses = getExpenses(filters);

    // Sort expenses
    expenses.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'vendor':
          comparison = (a.vendor || '').localeCompare(b.vendor || '');
          break;
        case 'date':
        default:
          comparison = a.expense_date.localeCompare(b.expense_date);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Calculate totals
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

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

    // Validate event_id exists if provided
    if (hasEventId) {
      const event = getEventById(body.event_id);
      if (!event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 400 }
        );
      }
    }

    // Validate category_id exists if provided
    if (hasCategoryId) {
      const category = getCategoryById(body.category_id);
      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 400 }
        );
      }
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

    // TODO: Replace with real Supabase insert when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase.from('expenses').insert(expenseData).select().single();

    // Create mock expense
    const now = new Date().toISOString();
    const event = hasEventId ? getEventById(body.event_id) : null;
    const category = hasCategoryId ? getCategoryById(body.category_id) : null;

    const newExpense: ExpenseWithRelations = {
      id: `exp-new-${Date.now()}`,
      event_id: hasEventId ? body.event_id : null,
      category_id: hasCategoryId ? body.category_id : null,
      amount: amount,
      expense_date: body.expense_date,
      vendor: body.vendor || null,
      memo: body.memo || null,
      source_type: sourceType as ExpenseSource,
      source_reference: body.source_reference || null,
      is_duplicate: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      event_name: event?.name || null,
      category_name: category?.name || null,
      target_type: hasEventId ? 'event' : 'category',
      target_name: event?.name || category?.name || 'Unknown',
    };

    // In a real implementation, we would add to the database
    // For mock purposes, we'll just return the created expense
    // allExpenses.push(newExpense); // Not persisting in mock

    return NextResponse.json(newExpense, { status: 201 });
  } catch (err) {
    console.error('Create expense error:', err);
    logError('Failed to create expense', { error: err as Error, source: 'api/expenses', context: { method: 'POST' } });
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    );
  }
}
