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

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

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
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    if (filters.fiscal_year_id) query = query.eq('fiscal_year_id', filters.fiscal_year_id);

    // Fetch paginated categories and all category expense totals in parallel (avoids N+1)
    const [categoriesResult, expenseTotalsResult] = await Promise.all([
      query.order('name', { ascending: true }).range(from, to),
      supabase
        .from('expenses')
        .select('category_id, amount')
        .not('category_id', 'is', null)
        .is('deleted_at', null),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;

    const total = categoriesResult.count ?? 0;

    // Build expense totals map from single query
    const expenseByCategory = new Map<string, { total: number; count: number }>();
    for (const exp of expenseTotalsResult.data || []) {
      if (exp.category_id) {
        const prev = expenseByCategory.get(exp.category_id) || { total: 0, count: 0 };
        expenseByCategory.set(exp.category_id, { total: prev.total + exp.amount, count: prev.count + 1 });
      }
    }

    const categories: CategoryWithTotals[] = (categoriesResult.data || []).map(category => {
      const stats = expenseByCategory.get(category.id) || { total: 0, count: 0 };
      const budgetAmount = category.budget_amount ?? 0;
      return {
        ...category,
        budget_amount: budgetAmount,
        actual_spent: stats.total,
        remaining: budgetAmount - stats.total,
        expense_count: stats.count,
      };
    });

    return NextResponse.json({
      categories,
      meta: {
        total,
        filters_applied: filters,
      },
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
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

    // Validate input lengths
    if (String(body.name).length > 200) {
      return NextResponse.json(
        { error: 'Category name must be 200 characters or fewer' },
        { status: 400 }
      );
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

    // Check for duplicate name (escape LIKE special characters)
    const escapedName = String(body.name).replace(/[%_\\]/g, '\\$&');
    const { data: existing } = await supabase
      .from('budget_categories')
      .select('id')
      .ilike('name', escapedName)
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
