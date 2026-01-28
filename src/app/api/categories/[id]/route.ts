/**
 * The Counting House - Single Category API
 *
 * Endpoints:
 * GET /api/categories/[id] - Get a single category with its expenses
 * PUT /api/categories/[id] - Update a category
 * DELETE /api/categories/[id] - Soft delete a category
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCategoryById,
  getCategoryWithTotals,
  getExpensesByCategoryId,
  mockCategories,
} from '@/lib/mock-data/categories';
import { mockFiscalYear } from '@/lib/mock-data/events';

// ============================================
// GET /api/categories/[id]
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: Replace with real Supabase query when connected
    // const supabase = await createClient();
    // const { data: category, error } = await supabase
    //   .from('budget_categories')
    //   .select('*, expenses(*)')
    //   .eq('id', id)
    //   .is('deleted_at', null)
    //   .single();

    const category = getCategoryById(id);

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const categoryWithTotals = getCategoryWithTotals(category);
    const expenses = getExpensesByCategoryId(id);

    return NextResponse.json({
      category: categoryWithTotals,
      expenses,
      fiscal_year: mockFiscalYear,
    });
  } catch (error) {
    console.error('Get category error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/categories/[id]
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if category exists
    const existingCategory = getCategoryById(id);
    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

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

    // Check for duplicate name if name is being changed
    if (body.name && body.name.toLowerCase() !== existingCategory.name.toLowerCase()) {
      const duplicateCategory = mockCategories.find(
        c => c.name.toLowerCase() === body.name.toLowerCase() && !c.deleted_at && c.id !== id
      );
      if (duplicateCategory) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 400 }
        );
      }
    }

    // TODO: Replace with real Supabase update when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase
    //   .from('budget_categories')
    //   .update({ ...body, updated_at: new Date().toISOString() })
    //   .eq('id', id)
    //   .select()
    //   .single();

    // Create updated category (mock)
    const now = new Date().toISOString();
    const updatedCategory = {
      ...existingCategory,
      name: body.name ?? existingCategory.name,
      fiscal_year_id: body.fiscal_year_id ?? existingCategory.fiscal_year_id,
      budget_amount: body.budget_amount !== undefined ? parseFloat(body.budget_amount) : existingCategory.budget_amount,
      description: body.description !== undefined ? body.description : existingCategory.description,
      updated_at: now,
    };

    const categoryWithTotals = getCategoryWithTotals(updatedCategory);

    return NextResponse.json(categoryWithTotals);
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/categories/[id]
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if category exists
    const existingCategory = getCategoryById(id);
    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // TODO: Replace with real Supabase soft delete when connected
    // const supabase = await createClient();
    // const { error } = await supabase
    //   .from('budget_categories')
    //   .update({ deleted_at: new Date().toISOString() })
    //   .eq('id', id);

    // Soft delete (mock) - just return success
    // In real implementation, we would set deleted_at

    return NextResponse.json({
      message: 'Category deleted successfully',
      id,
    });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
