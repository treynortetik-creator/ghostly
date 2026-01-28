'use client';

import { useState, useMemo } from 'react';
import { Receipt, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { ExpenseCard } from './ExpenseCard';
import { ExpenseFilters, ExpenseFilterPills, type ExpenseFiltersState } from './ExpenseFilters';
import type { Event, BudgetCategory } from '@/types/database';
import type { ExpenseWithRelations } from '@/lib/mock-data/expenses';

/* ============================================
   EXPENSE LIST COMPONENT
   ============================================
   Victorian-styled list of expenses with filtering,
   search, sorting, and grouped display options.
   ============================================ */

export type SortField = 'date' | 'amount' | 'vendor';
export type SortOrder = 'asc' | 'desc';

export interface ExpenseListProps {
  /** List of expenses to display */
  expenses: ExpenseWithRelations[];
  /** Available events for filtering */
  events: Event[];
  /** Available categories for filtering */
  categories: BudgetCategory[];
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Show filters */
  showFilters?: boolean;
  /** Callback when edit is clicked */
  onEdit?: (expense: ExpenseWithRelations) => void;
  /** Callback when delete is clicked */
  onDelete?: (expense: ExpenseWithRelations) => void;
}

const initialFilters: ExpenseFiltersState = {
  event_id: '',
  category_id: '',
  date_start: '',
  date_end: '',
  vendor: '',
  source_type: 'all',
};

export function ExpenseList({
  expenses,
  events,
  categories,
  isLoading = false,
  error = null,
  showFilters = true,
  onEdit,
  onDelete,
}: ExpenseListProps) {
  const [filters, setFilters] = useState<ExpenseFiltersState>(initialFilters);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    let filtered = expenses;

    // Apply event filter
    if (filters.event_id) {
      filtered = filtered.filter(e => e.event_id === filters.event_id);
    }

    // Apply category filter
    if (filters.category_id) {
      filtered = filtered.filter(e => e.category_id === filters.category_id);
    }

    // Apply date range filter
    if (filters.date_start) {
      filtered = filtered.filter(e => e.expense_date >= filters.date_start);
    }
    if (filters.date_end) {
      filtered = filtered.filter(e => e.expense_date <= filters.date_end);
    }

    // Apply vendor search
    if (filters.vendor.trim()) {
      const query = filters.vendor.toLowerCase();
      filtered = filtered.filter(e =>
        e.vendor?.toLowerCase().includes(query) || false
      );
    }

    // Apply source type filter
    if (filters.source_type !== 'all') {
      filtered = filtered.filter(e => e.source_type === filters.source_type);
    }

    return filtered;
  }, [expenses, filters]);

  // Sort expenses
  const sortedExpenses = useMemo(() => {
    const sorted = [...filteredExpenses];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'vendor':
          comparison = (a.vendor || '').localeCompare(b.vendor || '');
          break;
        case 'date':
        default:
          comparison = a.expense_date.localeCompare(b.expense_date);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredExpenses, sortField, sortOrder]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: ExpenseFiltersState) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
  };

  const handleRemoveFilter = (field: keyof ExpenseFiltersState) => {
    setFilters(prev => ({
      ...prev,
      [field]: field === 'source_type' ? 'all' : '',
    }));
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    return sortedExpenses.reduce(
      (acc, expense) => ({
        amount: acc.amount + expense.amount,
        count: acc.count + 1,
      }),
      { amount: 0, count: 0 }
    );
  }, [sortedExpenses]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Sort indicator
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-sepia/40" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-ink-gold" />
    ) : (
      <ArrowDown className="w-4 h-4 text-ink-gold" />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-wood-medium/10 rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 bg-wood-medium/10 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-ink-red/5 border-ink-red/20">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-12 h-12 text-ink-red mb-4" />
            <h3 className="font-serif text-xl font-semibold text-ink-red mb-2">
              Failed to Load Expenses
            </h3>
            <p className="text-sepia">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <>
          <ExpenseFilters
            filters={filters}
            events={events}
            categories={categories}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />

          {/* Filter pills */}
          <ExpenseFilterPills
            filters={filters}
            events={events}
            categories={categories}
            onRemoveFilter={handleRemoveFilter}
          />
        </>
      )}

      {/* Summary stats and sort controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 bg-parchment-dark rounded-lg border border-wood-medium/20">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-sepia">
            <span className="font-semibold text-wood-dark">{totals.count}</span> expense{totals.count !== 1 ? 's' : ''}
          </span>
          <span className="text-wood-medium/30">|</span>
          <span className="text-sm text-sepia">
            Total: <span className="font-semibold tabular-nums text-wood-dark">{formatCurrency(totals.amount)}</span>
          </span>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-sepia mr-1">Sort:</span>
          <button
            onClick={() => handleSort('date')}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === 'date' ? 'bg-ink-gold/10 text-ink-gold' : 'text-sepia hover:bg-wood-medium/10'}
            `}
          >
            Date
            <SortIcon field="date" />
          </button>
          <button
            onClick={() => handleSort('amount')}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === 'amount' ? 'bg-ink-gold/10 text-ink-gold' : 'text-sepia hover:bg-wood-medium/10'}
            `}
          >
            Amount
            <SortIcon field="amount" />
          </button>
          <button
            onClick={() => handleSort('vendor')}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === 'vendor' ? 'bg-ink-gold/10 text-ink-gold' : 'text-sepia hover:bg-wood-medium/10'}
            `}
          >
            Vendor
            <SortIcon field="vendor" />
          </button>
        </div>
      </div>

      {/* Expenses list */}
      {sortedExpenses.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Receipt className="w-12 h-12 text-sepia/40 mb-4" />
              <h3 className="font-serif text-xl font-semibold text-wood-dark mb-2">
                No Expenses Found
              </h3>
              <p className="text-sepia">
                {Object.values(filters).some(v => v !== '' && v !== 'all')
                  ? 'Try adjusting your filters.'
                  : 'No expenses have been recorded yet.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedExpenses.map(expense => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ExpenseList;
