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

export const mockCategoryExpenses: Expense[] = [
  // Exhibit Properties expenses
  {
    id: 'exp-cat-001',
    event_id: null,
    category_id: 'cat-002',
    amount: 4500,
    expense_date: '2026-01-10',
    vendor: 'DisplayCraft Inc.',
    memo: 'Retractable banner stands (qty 6)',
    source_type: 'brex',
    source_reference: 'brex-txn-cat-001',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-cat-002',
    event_id: null,
    category_id: 'cat-002',
    amount: 2800,
    expense_date: '2026-01-15',
    vendor: 'Trade Show Direct',
    memo: 'Table covers and backdrops',
    source_type: 'manual',
    source_reference: null,
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  // Swag expenses
  {
    id: 'exp-cat-003',
    event_id: null,
    category_id: 'cat-003',
    amount: 3200,
    expense_date: '2026-01-08',
    vendor: 'Promo Products Co.',
    memo: 'Branded pens, notebooks, and bags',
    source_type: 'brex',
    source_reference: 'brex-txn-cat-002',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-cat-004',
    event_id: null,
    category_id: 'cat-003',
    amount: 1850,
    expense_date: '2026-01-20',
    vendor: 'CustomInk',
    memo: 'Company polo shirts for team',
    source_type: 'manual',
    source_reference: null,
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-cat-005',
    event_id: null,
    category_id: 'cat-003',
    amount: 2100,
    expense_date: '2026-02-01',
    vendor: 'SwagUp',
    memo: 'Premium gift boxes for VIP attendees',
    source_type: 'pdf',
    source_reference: 'invoice-swagup-001.pdf',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  // Marketing Expenses
  {
    id: 'exp-cat-006',
    event_id: null,
    category_id: 'cat-004',
    amount: 1500,
    expense_date: '2026-01-05',
    vendor: 'LinkedIn Ads',
    memo: 'Q1 conference promotion campaign',
    source_type: 'brex',
    source_reference: 'brex-txn-cat-003',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-cat-007',
    event_id: null,
    category_id: 'cat-004',
    amount: 800,
    expense_date: '2026-01-22',
    vendor: 'Canva Pro',
    memo: 'Annual design subscription',
    source_type: 'manual',
    source_reference: null,
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  // Conference Cost Increase
  {
    id: 'exp-cat-008',
    event_id: null,
    category_id: 'cat-005',
    amount: 8000,
    expense_date: '2026-02-15',
    vendor: 'NIC Conference',
    memo: 'Spring conference sponsorship upgrade',
    source_type: 'manual',
    source_reference: null,
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  // Spare Funds - keeping it mostly unused
  {
    id: 'exp-cat-009',
    event_id: null,
    category_id: 'cat-001',
    amount: 2500,
    expense_date: '2026-01-25',
    vendor: 'Emergency Travel',
    memo: 'Last-minute flight rebooking due to weather',
    source_type: 'brex',
    source_reference: 'brex-txn-cat-004',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
];

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
