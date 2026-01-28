/**
 * The Counting House - Consolidated Mock Expenses Data
 * Combines event and category expenses for unified expense management
 */

import type { Expense, ExpenseSource } from '@/types/database';
import { mockExpenses as eventExpenses } from './events';
import { mockCategoryExpenses } from './categories';
import { getEventById } from './events';
import { getCategoryById } from './categories';

// ============================================
// CONSOLIDATED EXPENSES
// ============================================

// Additional expenses for demonstration purposes
const now = new Date().toISOString();

const additionalExpenses: Expense[] = [
  // More event expenses for filtering demonstration
  {
    id: 'exp-011',
    event_id: 'evt-exec-004',
    category_id: null,
    amount: 12500,
    expense_date: '2026-02-20',
    vendor: 'Ritz Carlton Palm Beach',
    memo: 'Executive dinner venue deposit',
    source_type: 'manual',
    source_reference: null,
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-012',
    event_id: 'evt-natl-016',
    category_id: null,
    amount: 8500,
    expense_date: '2026-08-15',
    vendor: 'LeadingAge',
    memo: 'Annual meeting booth registration',
    source_type: 'manual',
    source_reference: null,
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-013',
    event_id: 'evt-natl-016',
    category_id: null,
    amount: 4200,
    expense_date: '2026-09-01',
    vendor: 'Exhibit Works',
    memo: 'Booth setup and logistics',
    source_type: 'brex',
    source_reference: 'brex-txn-005',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-014',
    event_id: 'evt-state-008',
    category_id: null,
    amount: 3500,
    expense_date: '2026-07-20',
    vendor: 'FSLA',
    memo: 'Conference sponsorship',
    source_type: 'pdf',
    source_reference: 'invoice-fsla-001.pdf',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-015',
    event_id: 'evt-exec-007',
    category_id: null,
    amount: 15000,
    expense_date: '2026-03-15',
    vendor: 'SLIF',
    memo: 'Innovation showcase booth premium',
    source_type: 'manual',
    source_reference: null,
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  // More category expenses
  {
    id: 'exp-cat-010',
    event_id: null,
    category_id: 'cat-002',
    amount: 3500,
    expense_date: '2026-02-28',
    vendor: 'ExhibitBuilder Pro',
    memo: 'New retractable banner designs',
    source_type: 'brex',
    source_reference: 'brex-txn-cat-005',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
  {
    id: 'exp-cat-011',
    event_id: null,
    category_id: 'cat-003',
    amount: 4500,
    expense_date: '2026-03-10',
    vendor: 'SwagMaster Inc.',
    memo: 'Q2 conference giveaways batch',
    source_type: 'pdf',
    source_reference: 'invoice-swag-002.pdf',
    is_duplicate: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  },
];

// Combine all expenses
export const allExpenses: Expense[] = [
  ...eventExpenses,
  ...mockCategoryExpenses,
  ...additionalExpenses,
];

// ============================================
// EXPENSE WITH RELATIONS TYPE
// ============================================

export interface ExpenseWithRelations extends Expense {
  event_name: string | null;
  category_name: string | null;
  target_type: 'event' | 'category';
  target_name: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all expenses with relations populated
 */
export function getAllExpensesWithRelations(): ExpenseWithRelations[] {
  return allExpenses
    .filter(e => !e.deleted_at)
    .map(expense => {
      const event = expense.event_id ? getEventById(expense.event_id) : null;
      const category = expense.category_id ? getCategoryById(expense.category_id) : null;

      return {
        ...expense,
        event_name: event?.name || null,
        category_name: category?.name || null,
        target_type: expense.event_id ? 'event' : 'category',
        target_name: event?.name || category?.name || 'Unknown',
      };
    });
}

/**
 * Get expenses with optional filters
 */
export function getExpenses(filters?: {
  event_id?: string;
  category_id?: string;
  date_start?: string;
  date_end?: string;
  vendor?: string;
  source_type?: ExpenseSource;
}): ExpenseWithRelations[] {
  let expenses = getAllExpensesWithRelations();

  if (filters?.event_id) {
    expenses = expenses.filter(e => e.event_id === filters.event_id);
  }
  if (filters?.category_id) {
    expenses = expenses.filter(e => e.category_id === filters.category_id);
  }
  if (filters?.date_start) {
    expenses = expenses.filter(e => e.expense_date >= filters.date_start!);
  }
  if (filters?.date_end) {
    expenses = expenses.filter(e => e.expense_date <= filters.date_end!);
  }
  if (filters?.vendor) {
    const vendorLower = filters.vendor.toLowerCase();
    expenses = expenses.filter(e =>
      e.vendor?.toLowerCase().includes(vendorLower) || false
    );
  }
  if (filters?.source_type) {
    expenses = expenses.filter(e => e.source_type === filters.source_type);
  }

  return expenses;
}

/**
 * Get a single expense by ID
 */
export function getExpenseById(id: string): ExpenseWithRelations | undefined {
  const expense = allExpenses.find(e => e.id === id && !e.deleted_at);
  if (!expense) return undefined;

  const event = expense.event_id ? getEventById(expense.event_id) : null;
  const category = expense.category_id ? getCategoryById(expense.category_id) : null;

  return {
    ...expense,
    event_name: event?.name || null,
    category_name: category?.name || null,
    target_type: expense.event_id ? 'event' : 'category',
    target_name: event?.name || category?.name || 'Unknown',
  };
}

/**
 * Source type display labels
 */
export const sourceTypeLabels: Record<ExpenseSource, string> = {
  manual: 'Manual Entry',
  brex: 'Brex Import',
  pdf: 'PDF Upload',
};

/**
 * Source type badge colors
 */
export const sourceTypeBadgeColors: Record<ExpenseSource, string> = {
  manual: 'bg-sepia/15 text-sepia border-sepia/30',
  brex: 'bg-ink-green/15 text-ink-green border-ink-green/30',
  pdf: 'bg-ink-gold/15 text-ink-gold border-ink-gold/30',
};
