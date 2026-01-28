/**
 * The Counting House - Mock Budget Category Data
 * Based on seed.sql for development before Supabase connection
 */

import type { BudgetCategory, Expense, FiscalYear } from '@/types/database';
import { mockFiscalYear } from './events';

// ============================================
// MOCK BUDGET CATEGORIES (Based on seed.sql)
// ============================================

const now = new Date().toISOString();

export const mockCategories: BudgetCategory[] = [
  {
    id: 'cat-001',
    name: 'Spare Funds',
    fiscal_year_id: 'fy-2026-0001',
    budget_amount: 30000,
    description: 'Reserve budget for unexpected expenses and opportunities',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'cat-002',
    name: 'Exhibit Properties',
    fiscal_year_id: 'fy-2026-0001',
    budget_amount: 15000,
    description: 'Booth displays, banners, and exhibition materials',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'cat-003',
    name: 'Swag',
    fiscal_year_id: 'fy-2026-0001',
    budget_amount: 14000,
    description: 'Promotional items, giveaways, and branded merchandise',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'cat-004',
    name: 'Marketing Expenses',
    fiscal_year_id: 'fy-2026-0001',
    budget_amount: 5000,
    description: 'General marketing materials and digital advertising',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'cat-005',
    name: 'Conference Cost Increase',
    fiscal_year_id: 'fy-2026-0001',
    budget_amount: 50000,
    description: 'Buffer for conference cost increases and sponsorship upgrades',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
];

// ============================================
// MOCK CATEGORY EXPENSES
// ============================================

export const mockCategoryExpenses: Expense[] = [];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all categories, optionally filtered
 */
export function getCategories(filters?: {
  fiscal_year_id?: string;
}): BudgetCategory[] {
  let categories = mockCategories.filter(c => !c.deleted_at);

  if (filters?.fiscal_year_id) {
    categories = categories.filter(c => c.fiscal_year_id === filters.fiscal_year_id);
  }

  return categories;
}

/**
 * Get a single category by ID
 */
export function getCategoryById(id: string): BudgetCategory | undefined {
  return mockCategories.find(c => c.id === id && !c.deleted_at);
}

/**
 * Get expenses for a category
 */
export function getExpensesByCategoryId(categoryId: string): Expense[] {
  return mockCategoryExpenses.filter(e => e.category_id === categoryId && !e.deleted_at);
}

/**
 * Calculate actual spent for a category
 */
export function getCategoryActualSpent(categoryId: string): number {
  return getExpensesByCategoryId(categoryId).reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Category with calculated totals
 */
export interface CategoryWithTotals extends BudgetCategory {
  actual_spent: number;
  remaining: number;
  expense_count: number;
}

/**
 * Get category with calculated totals
 */
export function getCategoryWithTotals(category: BudgetCategory): CategoryWithTotals {
  const expenses = getExpensesByCategoryId(category.id);
  const actual_spent = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    ...category,
    actual_spent,
    remaining: category.budget_amount - actual_spent,
    expense_count: expenses.length,
  };
}

/**
 * Get all categories with totals
 */
export function getCategoriesWithTotals(filters?: {
  fiscal_year_id?: string;
}): CategoryWithTotals[] {
  const categories = getCategories(filters);
  return categories.map(getCategoryWithTotals);
}
