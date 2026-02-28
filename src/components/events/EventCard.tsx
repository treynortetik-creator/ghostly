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
      data-oid="28pq_em"
    >
      <CardContent className={compact ? "py-3" : "py-4"} data-oid="y3:2aj3">
        {/* Main content - clickable area */}
        <Link href={`/events/${event.id}`} className="block" data-oid="iw5qd2r">
          <div
            className="flex flex-col lg:flex-row lg:items-center gap-4"
            data-oid="y2i26if"
          >
            {/* Left section: Name, type badge, and meta */}
            <div className="flex-1 min-w-0" data-oid="-cnxzep">
              <div className="flex items-start gap-3" data-oid="w6izsnv">
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
                    data-oid="tnf7qzk"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" data-oid="zt-bow:" />
                    ) : (
                      <ChevronRight className="w-4 h-4" data-oid="ix5lfp6" />
                    )}
                  </button>
                )}

                <div className="flex-1 min-w-0" data-oid="14-a_6i">
                  {/* Event name and type */}
                  <div
                    className="flex flex-wrap items-center gap-2 mb-1"
                    data-oid="9f8gkpk"
                  >
                    <h3
                      className="font-semibold text-foreground truncate"
                      data-oid="vyp_d6z"
                    >
                      {event.name}
                    </h3>
                    {event.event_type_record && (
                      <span
                        className={`
                          inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                          ${typeColorClasses[event.event_type_record?.name?.toLowerCase() ?? ''] || "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30"}
                        `}
                        data-oid="p6:y021"
                      >
                        {event.event_type_record.name}
                      </span>
                    )}
                    <span
                      className="text-xs font-medium text-muted-foreground bg-card px-2 py-0.5 rounded border border-border"
                      data-oid="l-ed822"
                    >
                      {event.quarter}
                    </span>
                  </div>

                  {/* Meta info: date and location */}
                  {!compact && (
                    <div
                      className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
                      data-oid="f2tug:p"
                    >
                      <span
                        className="inline-flex items-center gap-1"
                        data-oid="2ecpa6j"
                      >
                        <Calendar className="w-3.5 h-3.5" data-oid="-fzder5" />
                        {formatDateRange()}
                      </span>
                      {event.location && (
                        <span
                          className="inline-flex items-center gap-1"
                          data-oid=".squrta"
                        >
                          <MapPin className="w-3.5 h-3.5" data-oid="j1en2ox" />
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
                  data-oid=":bif73x"
                >
                  {event.expansion_goal > 0 && (
                    <div
                      className="flex items-center gap-1.5 text-muted-foreground"
                      data-oid="723rau7"
                    >
                      <Target className="w-4 h-4" data-oid="zoqjomt" />
                      <span className="tabular-nums" data-oid="zk.2oyp">
                        {event.expansion_goal} exp
                      </span>
                    </div>
                  )}
                  {event.net_new_goal > 0 && (
                    <div
                      className="flex items-center gap-1.5 text-muted-foreground"
                      data-oid=".2af96e"
                    >
                      <Target
                        className="w-4 h-4 text-emerald-400"
                        data-oid="y2x41mk"
                      />
                      <span className="tabular-nums" data-oid="fwf3q82">
                        {event.net_new_goal} new
                      </span>
                    </div>
                  )}
                </div>
              )}

            {/* Right section: Budget progress */}
            <div className="lg:w-64 xl:w-80" data-oid="xjle1hi">
              <div
                className="flex items-center justify-between mb-1.5 text-sm"
                data-oid="trhrw7u"
              >
                <span className="text-muted-foreground" data-oid="zqhx_4c">
                  {formatCurrency(event.actual_spent)} of{" "}
                  {formatCurrency(event.budget_amount)}
                </span>
                <span
                  className={`
                    font-medium tabular-nums
                    ${event.remaining < 0 ? "text-destructive" : event.remaining < event.budget_amount * 0.2 ? "text-spectral" : "text-emerald-400"}
                  `}
                  data-oid="tl.cj1p"
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
                data-oid="_o31nsb"
              />

              {!compact && event.expense_count > 0 && (
                <div
                  className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"
                  data-oid="qrhupo_"
                >
                  <Receipt className="w-3 h-3" data-oid="uhbxf_c" />
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
            data-oid="x.2in9-"
          >
            <h4
              className="text-sm font-medium text-foreground mb-3"
              data-oid="aejjr3h"
            >
              Expenses ({expenses.length})
            </h4>
            <div className="space-y-2" data-oid="f572789">
              {expenses.slice(0, 5).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between py-2 px-3 bg-background/50 rounded text-sm"
                  data-oid="7zd:i56"
                >
                  <div className="flex-1 min-w-0" data-oid="4itwv_i">
                    <span
                      className="font-medium text-foreground"
                      data-oid="t_et412"
                    >
                      {expense.vendor || "Unknown Vendor"}
                    </span>
                    {expense.memo && (
                      <p
                        className="text-muted-foreground text-xs truncate mt-0.5"
                        data-oid="s6_i4za"
                      >
                        {expense.memo}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4" data-oid="velyudf">
                    <span
                      className="font-medium tabular-nums text-foreground"
                      data-oid="d_w6e:2"
                    >
                      {formatCurrency(expense.amount)}
                    </span>
                    <p className="text-xs text-muted-foreground" data-oid="hk8mody">
                      {formatDateShort(expense.expense_date)}
                    </p>
                  </div>
                </div>
              ))}
              {expenses.length > 5 && (
                <Link
                  href={`/events/${event.id}`}
                  className="block text-center py-2 text-sm text-spectral hover:text-foreground transition-colors"
                  data-oid="p6r6:la"
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
