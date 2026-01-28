'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, ChevronDown, ChevronRight, Receipt, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Expense, EventWithTotals } from '@/types/database';
import { eventTypeLabels } from '@/types/database';

/* ============================================
   EVENT CARD COMPONENT
   ============================================
   Victorian-styled card showing event summary with
   budget progress and optional expense expansion.
   ============================================ */

export interface EventCardProps {
  /** Event data with calculated totals */
  event: EventWithTotals;
  /** Optional list of expenses to show when expanded */
  expenses?: Expense[];
  /** Whether to show the expandable expenses section */
  expandable?: boolean;
  /** Callback when card is clicked (for navigation) */
  onClick?: () => void;
  /** Show compact version without some details */
  compact?: boolean;
}

const typeColorClasses: Record<string, string> = {
  executive: 'bg-ink-gold/15 text-ink-gold border-ink-gold/30',
  national: 'bg-ink-green/15 text-ink-green border-ink-green/30',
  state: 'bg-wood-medium/15 text-wood-dark border-wood-medium/30',
  regional: 'bg-sepia/15 text-sepia border-sepia/30',
  customer: 'bg-ink-red/15 text-ink-red border-ink-red/30',
};

export function EventCard({
  event,
  expenses = [],
  expandable = false,
  onClick,
  compact = false,
}: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateRange = () => {
    if (!event.date_start) return 'Date TBD';
    const start = formatDate(event.date_start);
    const end = event.date_end ? formatDate(event.date_end) : null;
    if (end && start !== end) {
      return `${start} - ${end}`;
    }
    return start;
  };

  const percentage = event.budget_amount > 0
    ? Math.round((event.actual_spent / event.budget_amount) * 100)
    : 0;

  const CardWrapper = onClick ? 'button' : 'div';

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
        <Link href={`/events/${event.id}`} className="block">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Left section: Name, type badge, and meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                {/* Expandable toggle (if applicable) */}
                {expandable && event.expense_count > 0 && (
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
                  {/* Event name and type */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-serif font-semibold text-wood-dark truncate">
                      {event.name}
                    </h3>
                    <span
                      className={`
                        inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                        ${typeColorClasses[event.event_type]}
                      `}
                    >
                      {eventTypeLabels[event.event_type]}
                    </span>
                    <span className="text-xs font-medium text-sepia bg-parchment-dark px-2 py-0.5 rounded border border-wood-medium/20">
                      {event.quarter}
                    </span>
                  </div>

                  {/* Meta info: date and location */}
                  {!compact && (
                    <div className="flex flex-wrap items-center gap-3 text-sm text-sepia">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateRange()}
                      </span>
                      {event.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Middle section: Goals (optional) */}
            {!compact && (event.expansion_goal > 0 || event.net_new_goal > 0) && (
              <div className="hidden xl:flex items-center gap-4 text-sm">
                {event.expansion_goal > 0 && (
                  <div className="flex items-center gap-1.5 text-sepia">
                    <Target className="w-4 h-4" />
                    <span className="tabular-nums">{event.expansion_goal} exp</span>
                  </div>
                )}
                {event.net_new_goal > 0 && (
                  <div className="flex items-center gap-1.5 text-sepia">
                    <Target className="w-4 h-4 text-ink-green" />
                    <span className="tabular-nums">{event.net_new_goal} new</span>
                  </div>
                )}
              </div>
            )}

            {/* Right section: Budget progress */}
            <div className="lg:w-64 xl:w-80">
              <div className="flex items-center justify-between mb-1.5 text-sm">
                <span className="text-sepia">
                  {formatCurrency(event.actual_spent)} of {formatCurrency(event.budget_amount)}
                </span>
                <span
                  className={`
                    font-medium tabular-nums
                    ${event.remaining < 0 ? 'text-ink-red' : event.remaining < event.budget_amount * 0.2 ? 'text-ink-gold' : 'text-ink-green'}
                  `}
                >
                  {event.remaining >= 0 ? formatCurrency(event.remaining) : `-${formatCurrency(Math.abs(event.remaining))}`} left
                </span>
              </div>
              <ProgressBar
                value={event.actual_spent}
                max={event.budget_amount}
                size="sm"
              />
              {!compact && event.expense_count > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-sepia">
                  <Receipt className="w-3 h-3" />
                  {event.expense_count} expense{event.expense_count !== 1 ? 's' : ''}
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
                  href={`/events/${event.id}`}
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

export default EventCard;
