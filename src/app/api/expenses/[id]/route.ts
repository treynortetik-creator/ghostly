/**
 * The Counting House - Single Expense API
 *
 * Endpoints:
 * GET /api/expenses/[id] - Get a single expense
 * PUT /api/expenses/[id] - Update an expense
 * DELETE /api/expenses/[id] - Soft delete an expense
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ExpenseSource } from '@/types/database';
import {
  getExpenseById,
  allExpenses,
  type ExpenseWithRelations,
} from '@/lib/mock-data/expenses';
import { getEventById } from '@/lib/mock-data/events';
import { getCategoryById } from '@/lib/mock-data/categories';

// ============================================
// GET /api/expenses/[id]
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: Replace with real Supabase query when connected
    // const supabase = await createClient();
    // const { data: expense, error } = await supabase
    //   .from('expenses')
    //   .select('*, events(*), budget_categories(*)')
    //   .eq('id', id)
    //   .is('deleted_at', null)
    //   .single();

    const expense = getExpenseById(id);

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ expense });
  } catch (error) {
    console.error('Get expense error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/expenses/[id]
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if expense exists
    const existingExpense = getExpenseById(id);
    if (!existingExpense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    // Determine new event_id and category_id values
    const newEventId = body.event_id !== undefined ? body.event_id : existingExpense.event_id;
    const newCategoryId = body.category_id !== undefined ? body.category_id : existingExpense.category_id;

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

    // Validate event_id exists if provided
    if (hasEventId) {
      const event = getEventById(newEventId);
      if (!event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 400 }
        );
      }
    }

    // Validate category_id exists if provided
    if (hasCategoryId) {
      const category = getCategoryById(newCategoryId);
      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 400 }
        );
      }
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

    // TODO: Replace with real Supabase update when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase
    //   .from('expenses')
    //   .update({ ...body, updated_at: new Date().toISOString() })
    //   .eq('id', id)
    //   .select()
    //   .single();

    // Create updated expense (mock)
    const now = new Date().toISOString();
    const event = hasEventId ? getEventById(newEventId) : null;
    const category = hasCategoryId ? getCategoryById(newCategoryId) : null;

    const updatedExpense: ExpenseWithRelations = {
      ...existingExpense,
      event_id: hasEventId ? newEventId : null,
      category_id: hasCategoryId ? newCategoryId : null,
      amount: body.amount !== undefined ? parseFloat(body.amount) : existingExpense.amount,
      expense_date: body.expense_date ?? existingExpense.expense_date,
      vendor: body.vendor !== undefined ? body.vendor : existingExpense.vendor,
      memo: body.memo !== undefined ? body.memo : existingExpense.memo,
      source_type: body.source_type ?? existingExpense.source_type,
      source_reference: body.source_reference !== undefined ? body.source_reference : existingExpense.source_reference,
      updated_at: now,
      event_name: event?.name || null,
      category_name: category?.name || null,
      target_type: hasEventId ? 'event' : 'category',
      target_name: event?.name || category?.name || 'Unknown',
    };

    return NextResponse.json({ expense: updatedExpense });
  } catch (error) {
    console.error('Update expense error:', error);
    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/expenses/[id]
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if expense exists
    const existingExpense = getExpenseById(id);
    if (!existingExpense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    // TODO: Replace with real Supabase soft delete when connected
    // const supabase = await createClient();
    // const { error } = await supabase
    //   .from('expenses')
    //   .update({ deleted_at: new Date().toISOString() })
    //   .eq('id', id);

    // Soft delete (mock) - just return success
    // In real implementation, we would set deleted_at

    return NextResponse.json({
      message: 'Expense deleted successfully',
      id,
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
