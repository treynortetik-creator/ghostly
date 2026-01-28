'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Receipt, Folder } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Expense, CategoryWithTotals } from '@/types/database';

/* ============================================
   CATEGORY CARD COMPONENT
   ============================================
   Victorian-styled card showing budget category
   summary with progress bar and optional
   expense expansion.
   ============================================ */

export interface CategoryCardProps {
  /** Category data with calculated totals */
  category: CategoryWithTotals;
  /** Optional list of expenses to show when expanded */
  expenses?: Expense[];
  /** Whether to show the expandable expenses section */
  expandable?: boolean;
  /** Callback when card is clicked (for navigation) */
  onClick?: () => void;
  /** Show compact version without some details */
  compact?: boolean;
}

export function CategoryCard({
  category,
  expenses = [],
  expandable = false,
  onClick,
  compact = false,
}: CategoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const percentage = category.budget_amount > 0
    ? Math.round((category.actual_spent / category.budget_amount) * 100)
    : 0;

  return (
    <Card
      className={`
        transition-all duration-200
        ${onClick ? 'hover:shadow-lg cursor-pointer' : ''}
        ${isExpanded ? 'ring-1 ring-wood-medium/30' : ''}
      `}
    >
      <CardContent className={compact ? 'py-3' : 'py-4'}>
        {/* Main content - clickable area */}
        <Link href={`/categories/${category.id}`} className="block">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Left section: Name and description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                {/* Expandable toggle (if applicable) */}
                {expandable && category.expense_count > 0 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    className="mt-1 p-1 rounded hover:bg-wood-medium/10 text-sepia transition-colors"
                    aria-label={isExpanded ? 'Collapse expenses' : 'Expand expenses'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  {/* Category name and icon */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Folder className="w-4 h-4 text-ink-gold" />
                    <h3 className="font-serif font-semibold text-wood-dark truncate">
                      {category.name}
                    </h3>
                  </div>

                  {/* Description */}
                  {!compact && category.description && (
                    <p className="text-sm text-sepia line-clamp-1">
                      {category.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right section: Budget progress */}
            <div className="lg:w-64 xl:w-80">
              <div className="flex items-center justify-between mb-1.5 text-sm">
                <span className="text-sepia">
                  {formatCurrency(category.actual_spent)} of {formatCurrency(category.budget_amount)}
                </span>
                <span
                  className={`
                    font-medium tabular-nums
                    ${category.remaining < 0 ? 'text-ink-red' : category.remaining < category.budget_amount * 0.2 ? 'text-ink-gold' : 'text-ink-green'}
                  `}
                >
                  {category.remaining >= 0 ? formatCurrency(category.remaining) : `-${formatCurrency(Math.abs(category.remaining))}`} left
                </span>
              </div>
              <ProgressBar
                value={category.actual_spent}
                max={category.budget_amount}
                size="sm"
              />
              {!compact && category.expense_count > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-sepia">
                  <Receipt className="w-3 h-3" />
                  {category.expense_count} expense{category.expense_count !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </Link>

        {/* Expanded expenses section */}
        {expandable && isExpanded && expenses.length > 0 && (
          <div className="mt-4 pt-4 border-t border-wood-medium/20">
            <h4 className="text-sm font-medium text-wood-dark mb-3">
              Expenses ({expenses.length})
            </h4>
            <div className="space-y-2">
              {expenses.slice(0, 5).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between py-2 px-3 bg-parchment/50 rounded text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-ink-black">
                      {expense.vendor || 'Unknown Vendor'}
                    </span>
                    {expense.memo && (
                      <p className="text-sepia text-xs truncate mt-0.5">
                        {expense.memo}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <span className="font-medium tabular-nums text-ink-black">
                      {formatCurrency(expense.amount)}
                    </span>
                    <p className="text-xs text-sepia">
                      {new Date(expense.expense_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {expenses.length > 5 && (
                <Link
                  href={`/categories/${category.id}`}
                  className="block text-center py-2 text-sm text-ink-gold hover:text-wood-dark transition-colors"
                >
                  View all {expenses.length} expenses
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CategoryCard;
