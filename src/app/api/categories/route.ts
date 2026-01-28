/**
 * The Counting House - Categories API
 *
 * Endpoints:
 * GET /api/categories - List all categories with optional filters
 * POST /api/categories - Create a new category
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CategoryWithTotals {
  id: string;
  name: string;
  fiscal_year_id: string | null;
  budget_amount: number;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  actual_spent: number;
  remaining: number;
  expense_count: number;
}

// ============================================
// GET /api/categories
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const fiscalYearId = searchParams.get('fiscal_year_id');

    // Build filters object
    const filters: {
      fiscal_year_id?: string;
    } = {};

    if (fiscalYearId) {
      filters.fiscal_year_id = fiscalYearId;
    }

    const supabase = await createClient();

    let query = supabase
      .from('budget_categories')
      .select('*')
      .is('deleted_at', null);

    if (filters.fiscal_year_id) query = query.eq('fiscal_year_id', filters.fiscal_year_id);

    const { data: rawCategories, error: categoriesError } = await query.order('name', { ascending: true });

    if (categoriesError) throw categoriesError;

    // Compute expense totals per category
    const categories: CategoryWithTotals[] = [];
    for (const category of rawCategories || []) {
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('category_id', category.id)
        .is('deleted_at', null);

      const actualSpent = (expenseData || []).reduce((sum, e) => sum + e.amount, 0);
      const budgetAmount = category.budget_amount ?? 0;
      categories.push({
        ...category,
        budget_amount: budgetAmount,
        actual_spent: actualSpent,
        remaining: budgetAmount - actualSpent,
        expense_count: (expenseData || []).length,
      });
    }

    return NextResponse.json({
      categories,
      meta: {
        total: categories.length,
        filters_applied: filters,
      },
    });
  } catch (error) {
    console.error('Categories API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/categories
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'budget_amount'];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate budget_amount is a positive number
    const budgetAmount = parseFloat(body.budget_amount);
    if (isNaN(budgetAmount) || budgetAmount < 0) {
      return NextResponse.json(
        { error: 'Invalid budget_amount. Must be a positive number' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check for duplicate name
    const { data: existing } = await supabase
      .from('budget_categories')
      .select('id')
      .ilike('name', body.name)
      .is('deleted_at', null);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 400 }
      );
    }

    const { data: newCategory, error: insertError } = await supabase
      .from('budget_categories')
      .insert({
        name: body.name,
        fiscal_year_id: body.fiscal_year_id || null,
        budget_amount: budgetAmount,
        description: body.description || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      ...newCategory,
      budget_amount: newCategory.budget_amount ?? 0,
      actual_spent: 0,
      remaining: newCategory.budget_amount ?? 0,
      expense_count: 0,
    }, { status: 201 });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
