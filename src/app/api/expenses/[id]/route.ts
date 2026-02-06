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
import { createClient } from '@/lib/supabase/server';
import { logAudit, getActor, computeChanges } from '@/lib/audit';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';

// ============================================
// GET /api/expenses/[id]
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: expense, error } = await supabase
      .from('expenses')
      .select('*, events(name), budget_categories(name)')
      .eq('id', id)
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
    const { events: eventRel, budget_categories: catRel, ...rest } = expense as any;
    const mapped = {
      ...rest,
      event_name: eventRel?.name || null,
      category_name: catRel?.name || null,
      target_type: rest.event_id ? 'event' as const : 'category' as const,
      target_name: eventRel?.name || catRel?.name || 'Unknown',
    };

    return NextResponse.json({ expense: mapped });
  } catch (error) {
    console.error('Get expense error:', error);
    logError('Failed to fetch expense', { error: error as Error, source: 'api/expenses/[id]', context: { method: 'GET' } });
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
  const deniedPut = requirePermission(request, 'write');
  if (deniedPut) return deniedPut;

  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Check if expense exists
    const { data: existingExpense, error: findError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
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
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, name')
        .eq('id', newEventId)
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
        .is('deleted_at', null)
        .single();

      if (categoryError || !category) {
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

    // Build update payload
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      event_id: hasEventId ? newEventId : null,
      category_id: hasCategoryId ? newCategoryId : null,
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
      .is('deleted_at', null)
      .select('*, events(name), budget_categories(name)')
      .single();

    if (updateError) throw updateError;

    // Map joined relations to flat fields
    const { events: eventRel, budget_categories: catRel, ...rest } = updatedExpense as any;
    const mapped = {
      ...rest,
      event_name: eventRel?.name || null,
      category_name: catRel?.name || null,
      target_type: rest.event_id ? 'event' as const : 'category' as const,
      target_name: eventRel?.name || catRel?.name || 'Unknown',
    };

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      const auditFields = ['amount', 'expense_date', 'vendor', 'memo', 'event_id', 'category_id', 'source_type', 'source_reference'];
      const changes = computeChanges(existingExpense as Record<string, unknown>, updatedExpense as Record<string, unknown>, auditFields);
      logAudit({
        entity_type: 'expense',
        entity_id: id,
        action: 'update',
        changes,
        actor,
        actor_type,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    return NextResponse.json({ expense: mapped });
  } catch (error) {
    console.error('Update expense error:', error);
    logError('Failed to update expense', { error: error as Error, source: 'api/expenses/[id]', context: { method: 'PUT' } });
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
  const deniedDel = requirePermission(request, 'write');
  if (deniedDel) return deniedDel;

  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if expense exists
    const { data: existingExpense, error: findError } = await supabase
      .from('expenses')
      .select('id')
      .eq('id', id)
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
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      logAudit({
        entity_type: 'expense',
        entity_id: id,
        action: 'delete',
        changes: null,
        actor,
        actor_type,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    return NextResponse.json({
      message: 'Expense deleted successfully',
      id,
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    logError('Failed to delete expense', { error: error as Error, source: 'api/expenses/[id]', context: { method: 'DELETE' } });
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
