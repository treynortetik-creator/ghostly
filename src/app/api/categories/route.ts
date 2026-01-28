/**
 * The Counting House - Categories API
 *
 * Endpoints:
 * GET /api/categories - List all categories with optional filters
 * POST /api/categories - Create a new category
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  mockCategories,
  getCategoriesWithTotals,
  type CategoryWithTotals,
} from '@/lib/mock-data/categories';
import { mockFiscalYear } from '@/lib/mock-data/events';

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

    // TODO: Replace with real Supabase queries when connected
    // const supabase = await createClient();
    // let query = supabase.from('budget_categories').select('*').is('deleted_at', null);
    // if (filters.fiscal_year_id) query = query.eq('fiscal_year_id', filters.fiscal_year_id);
    // const { data, error } = await query.order('name', { ascending: true });

    const categories = getCategoriesWithTotals(filters);

    // Sort by name alphabetically
    categories.sort((a, b) => a.name.localeCompare(b.name));

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

    // Check for duplicate name
    const existingCategory = mockCategories.find(
      c => c.name.toLowerCase() === body.name.toLowerCase() && !c.deleted_at
    );
    if (existingCategory) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 400 }
      );
    }

    // TODO: Replace with real Supabase insert when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase.from('budget_categories').insert(categoryData).select().single();

    // Create mock category
    const now = new Date().toISOString();
    const newCategory: CategoryWithTotals = {
      id: `cat-new-${Date.now()}`,
      name: body.name,
      fiscal_year_id: body.fiscal_year_id || mockFiscalYear.id,
      budget_amount: budgetAmount,
      description: body.description || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      actual_spent: 0,
      remaining: budgetAmount,
      expense_count: 0,
    };

    // In a real implementation, we would add to the database
    // For mock purposes, we'll just return the created category
    // mockCategories.push(newCategory); // Not persisting in mock

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
