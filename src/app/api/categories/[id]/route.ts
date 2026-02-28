/**
 * Ghostly - Single Category API
 *
 * Endpoints:
 * GET /api/categories/[id] - Get a single category with its expenses
 * PUT /api/categories/[id] - Update a category
 * DELETE /api/categories/[id] - Soft delete a category
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeChanges } from '@/lib/audit';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

// ============================================
// GET /api/categories/[id]
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'categories' },
  async (_request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: category, error: categoryError } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (categoryError?.code === 'PGRST116' || !category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    if (categoryError) throw categoryError;

    // Query expenses for this category
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('category_id', id)
      .is('deleted_at', null)
      .order('expense_date', { ascending: false });

    if (expensesError) throw expensesError;

    const expenseList = expenses || [];
    const actualSpent = expenseList.reduce((sum, e) => sum + e.amount, 0);
    const budgetAmount = category.budget_amount ?? 0;

    const categoryWithTotals = {
      ...category,
      budget_amount: budgetAmount,
      actual_spent: actualSpent,
      remaining: budgetAmount - actualSpent,
      expense_count: expenseList.length,
    };

    // Query fiscal year if category has one
    let fiscalYear = null;
    if (category.fiscal_year_id) {
      const { data: fy } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', category.fiscal_year_id)
        .single();
      fiscalYear = fy;
    }

    return NextResponse.json({
      category: categoryWithTotals,
      expenses: expenseList,
      fiscal_year: fiscalYear,
    });
  }
);

// ============================================
// PUT /api/categories/[id]
// ============================================

export const PUT = withApiHandler({ permission: 'write', resource: 'categories' },
  async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    // Check if category exists
    const { data: existingCategory, error: findError } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (findError?.code === 'PGRST116' || !existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    if (findError) throw findError;

    // Validate budget_amount if provided
    if (body.budget_amount !== undefined) {
      const budgetAmount = parseFloat(body.budget_amount);
      if (isNaN(budgetAmount) || budgetAmount < 0) {
        return NextResponse.json(
          { error: 'Invalid budget_amount. Must be a positive number' },
          { status: 400 }
        );
      }
    }

    // Validate name length if provided
    if (body.name !== undefined && String(body.name).length > 200) {
      return NextResponse.json(
        { error: 'Category name must be 200 characters or fewer' },
        { status: 400 }
      );
    }

    // Check for duplicate name if name is being changed
    if (body.name && body.name.toLowerCase() !== existingCategory.name.toLowerCase()) {
      const escapedName = String(body.name).replace(/[%_\\]/g, '\\$&');
      const { data: duplicateCategories } = await supabase
        .from('budget_categories')
        .select('id')
        .ilike('name', escapedName)
        .is('deleted_at', null)
        .neq('id', id)
        .limit(1);

      if (duplicateCategories && duplicateCategories.length > 0) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.fiscal_year_id !== undefined) updateData.fiscal_year_id = body.fiscal_year_id;
    if (body.budget_amount !== undefined) updateData.budget_amount = parseFloat(body.budget_amount);
    if (body.description !== undefined) updateData.description = body.description;

    const { data: updatedCategory, error: updateError } = await supabase
      .from('budget_categories')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (updateError) throw updateError;

    // Query expenses for totals
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('category_id', id)
      .is('deleted_at', null);

    const expenseList = expenses || [];
    const actualSpent = expenseList.reduce((sum, e) => sum + e.amount, 0);
    const budgetAmount = updatedCategory.budget_amount ?? 0;

    const categoryWithTotals = {
      ...updatedCategory,
      budget_amount: budgetAmount,
      actual_spent: actualSpent,
      remaining: budgetAmount - actualSpent,
      expense_count: expenseList.length,
    };

    // Audit log (non-blocking)
    const auditFields = ['name', 'budget_amount', 'description', 'fiscal_year_id'];
    const changes = computeChanges(existingCategory as Record<string, unknown>, updatedCategory as Record<string, unknown>, auditFields);
    await auditMutation(request, {
      entity_type: 'category',
      entity_id: id,
      action: 'update',
      changes,
    });

    return NextResponse.json(categoryWithTotals);
  }
);

// ============================================
// DELETE /api/categories/[id]
// ============================================

export const DELETE = withApiHandler({ permission: 'write', resource: 'categories' },
  async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const supabase = await createClient();

    // Check if category exists
    const { data: existingCategory, error: findError } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (findError?.code === 'PGRST116' || !existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    if (findError) throw findError;

    // Soft delete
    const { error: deleteError } = await supabase
      .from('budget_categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Audit log (non-blocking)
    await auditMutation(request, {
      entity_type: 'category',
      entity_id: id,
      action: 'delete',
      changes: null,
    });

    return NextResponse.json({
      message: 'Category deleted successfully',
      id,
    });
  }
);
