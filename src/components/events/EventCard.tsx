"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  ChevronDown,
  ChevronRight,
  Receipt,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency, formatDateShort } from "@/lib/format";
import type { Expense, EventWithTotals } from "@/types/database";

/* ============================================
   EVENT CARD COMPONENT
   ============================================
   Ghostly-themed card showing event summary with
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
  executive: "bg-spectral/10 text-spectral border-spectral",
  national: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  state: "bg-spectral/10 text-foreground border-border",
  regional: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  customer: "bg-red-400/10 text-destructive border-destructive/30",
};

export function EventCard({
  event,
  expenses = [],
  expandable = false,
  onClick,
  compact = false,
}: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDateRange = () => {
    if (!event.date_start) return "Date TBD";
    const start = formatDateShort(event.date_start);
    const end = event.date_end ? formatDateShort(event.date_end) : null;
    if (end && start !== end) {
      return `${start} - ${end}`;
    }
    return start;
  };

  const percentage =
    event.budget_amount > 0
      ? Math.round((event.actual_spent / event.budget_amount) * 100)
      : 0;

  const CardWrapper = onClick ? "button" : "div";

  return (
    <Card
      className={`
        transition-all duration-200
        ${onClick ? "hover:shadow-lg cursor-pointer" : ""}
        ${isExpanded ? "ring-1 ring-border" : ""}
      `}
     
    >
      <CardContent className={compact ? "py-3" : "py-4"}>
        {/* Main content - clickable area */}
        <Link href={`/events/${event.id}`} className="block">
          <div
            className="flex flex-col lg:flex-row lg:items-center gap-4"
           
          >
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
                    className="mt-1 p-1 rounded hover:bg-spectral/10 text-muted-foreground transition-colors"
                    aria-label={
                      isExpanded ? "Collapse expenses" : "Expand expenses"
                    }
                   
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
                  <div
                    className="flex flex-wrap items-center gap-2 mb-1"
                   
                  >
                    <h3
                      className="font-semibold text-foreground truncate"
                     
                    >
                      {event.name}
                    </h3>
                    {event.event_type_record && (
                      <span
                        className={`
                          inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                          ${typeColorClasses[event.event_type_record?.name?.toLowerCase() ?? ''] || "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30"}
                        `}
                       
                      >
                        {event.event_type_record.name}
                      </span>
                    )}
                    <span
                      className="text-xs font-medium text-muted-foreground bg-card px-2 py-0.5 rounded border border-border"
                     
                    >
                      {event.quarter}
                    </span>
                  </div>

                  {/* Meta info: date and location */}
                  {!compact && (
                    <div
                      className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
                     
                    >
                      <span
                        className="inline-flex items-center gap-1"
                       
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateRange()}
                      </span>
                      {event.location && (
                        <span
                          className="inline-flex items-center gap-1"
                         
                        >
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
            {!compact &&
              (event.expansion_goal > 0 || event.net_new_goal > 0) && (
                <div
                  className="hidden xl:flex items-center gap-4 text-sm"
                 
                >
                  {event.expansion_goal > 0 && (
                    <div
                      className="flex items-center gap-1.5 text-muted-foreground"
                     
                    >
                      <Target className="w-4 h-4" />
                      <span className="tabular-nums">
                        {event.expansion_goal} exp
                      </span>
                    </div>
                  )}
                  {event.net_new_goal > 0 && (
                    <div
                      className="flex items-center gap-1.5 text-muted-foreground"
                     
                    >
                      <Target
                        className="w-4 h-4 text-emerald-400"
                       
                      />
                      <span className="tabular-nums">
                        {event.net_new_goal} new
                      </span>
                    </div>
                  )}
                </div>
              )}

            {/* Right section: Budget progress */}
            <div className="lg:w-64 xl:w-80">
              <div
                className="flex items-center justify-between mb-1.5 text-sm"
               
              >
                <span className="text-muted-foreground">
                  {formatCurrency(event.actual_spent)} of{" "}
                  {formatCurrency(event.budget_amount)}
                </span>
                <span
                  className={`
                    font-medium tabular-nums
                    ${event.remaining < 0 ? "text-destructive" : event.remaining < event.budget_amount * 0.2 ? "text-spectral" : "text-emerald-400"}
                  `}
                 
                >
                  {event.remaining >= 0
                    ? formatCurrency(event.remaining)
                    : `-${formatCurrency(Math.abs(event.remaining))}`}{" "}
                  left
                </span>
              </div>
              <ProgressBar
                value={event.actual_spent}
                max={event.budget_amount}
                size="sm"
               
              />

              {!compact && event.expense_count > 0 && (
                <div
                  className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"
                 
                >
                  <Receipt className="w-3 h-3" />
                  {event.expense_count} expense
                  {event.expense_count !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        </Link>

        {/* Expanded expenses section */}
        {expandable && isExpanded && expenses.length > 0 && (
          <div
            className="mt-4 pt-4 border-t border-border"
           
          >
            <h4
              className="text-sm font-medium text-foreground mb-3"
             
            >
              Expenses ({expenses.length})
            </h4>
            <div className="space-y-2">
              {expenses.slice(0, 5).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between py-2 px-3 bg-background/50 rounded text-sm"
                 
                >
                  <div className="flex-1 min-w-0">
                    <span
                      className="font-medium text-foreground"
                     
                    >
                      {expense.vendor || "Unknown Vendor"}
                    </span>
                    {expense.memo && (
                      <p
                        className="text-muted-foreground text-xs truncate mt-0.5"
                       
                      >
                        {expense.memo}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <span
                      className="font-medium tabular-nums text-foreground"
                     
                    >
                      {formatCurrency(expense.amount)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(expense.expense_date)}
                    </p>
                  </div>
                </div>
              ))}
              {expenses.length > 5 && (
                <Link
                  href={`/events/${event.id}`}
                  className="block text-center py-2 text-sm text-spectral hover:text-foreground transition-colors"
                 
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
