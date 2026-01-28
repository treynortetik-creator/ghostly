/**
 * The Counting House - Consolidated Mock Expenses Data
 * Combines event and category expenses for unified expense management
 */

import type { Expense, ExpenseSource, ExpenseWithRelations } from '@/types/database';

// Re-export ExpenseWithRelations for backwards compatibility
export type { ExpenseWithRelations } from '@/types/database';
import { mockExpenses as eventExpenses } from './events';
import { mockCategoryExpenses } from './categories';
import { getEventById } from './events';
import { getCategoryById } from './categories';

// ============================================
// CONSOLIDATED EXPENSES
// ============================================

// Combine all expenses (seed data removed - expenses come from imports/manual entry)
export const allExpenses: Expense[] = [
  ...eventExpenses,
  ...mockCategoryExpenses,
];

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
 * Soft delete an expense by ID
 * Sets deleted_at timestamp so it's filtered out of queries
 */
export function deleteExpense(id: string): boolean {
  const index = allExpenses.findIndex(e => e.id === id && !e.deleted_at);
  if (index === -1) return false;

  allExpenses[index] = {
    ...allExpenses[index],
    deleted_at: new Date().toISOString(),
  };
  return true;
}

/**
 * Add a new expense to the mock data
 */
export function addExpense(expense: Expense): void {
  allExpenses.push(expense);
}

/**
 * Update an expense in the mock data
 */
export function updateExpense(id: string, updates: Partial<Expense>): boolean {
  const index = allExpenses.findIndex(e => e.id === id && !e.deleted_at);
  if (index === -1) return false;

  allExpenses[index] = {
    ...allExpenses[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  return true;
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
