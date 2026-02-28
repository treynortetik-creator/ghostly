"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Receipt, Folder } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/lib/format";
import type { Expense, CategoryWithTotals } from "@/types/database";

/* ============================================
   CATEGORY CARD COMPONENT
   ============================================
   Ghostly-themed card showing budget category
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

  const percentage =
    category.budget_amount > 0
      ? Math.round((category.actual_spent / category.budget_amount) * 100)
      : 0;

  return (
    <Card
      className={`
        transition-all duration-200
        ${onClick ? "hover:shadow-lg cursor-pointer" : ""}
        ${isExpanded ? "ring-1 ring-border" : ""}
      `}
      data-oid="uniaq1o"
    >
      <CardContent className={compact ? "py-3" : "py-4"} data-oid=".y:syaw">
        {/* Main content - clickable area */}
        <Link
          href={`/categories/${category.id}`}
          className="block"
          data-oid="l2754xy"
        >
          <div
            className="flex flex-col lg:flex-row lg:items-center gap-4"
            data-oid="pxv0xnl"
          >
            {/* Left section: Name and description */}
            <div className="flex-1 min-w-0" data-oid="6st_cll">
              <div className="flex items-start gap-3" data-oid="g3dlxdm">
                {/* Expandable toggle (if applicable) */}
                {expandable && category.expense_count > 0 && (
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
                    data-oid="4569z0k"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" data-oid=":bo5dk9" />
                    ) : (
                      <ChevronRight className="w-4 h-4" data-oid="pakdyj1" />
                    )}
                  </button>
                )}

                <div className="flex-1 min-w-0" data-oid="rs:9hml">
                  {/* Category name and icon */}
                  <div
                    className="flex flex-wrap items-center gap-2 mb-1"
                    data-oid="-b.8fxe"
                  >
                    <Folder
                      className="w-4 h-4 text-spectral"
                      data-oid="vw_vy28"
                    />
                    <h3
                      className="font-semibold text-foreground truncate"
                      data-oid="z8ji22_"
                    >
                      {category.name}
                    </h3>
                  </div>

                  {/* Description */}
                  {!compact && category.description && (
                    <p
                      className="text-sm text-muted-foreground line-clamp-1"
                      data-oid="oh1hodg"
                    >
                      {category.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right section: Budget progress */}
            <div className="lg:w-64 xl:w-80" data-oid="ib5yg.6">
              <div
                className="flex items-center justify-between mb-1.5 text-sm"
                data-oid="u-4:cxn"
              >
                <span className="text-muted-foreground" data-oid="qxko0rf">
                  {formatCurrency(category.actual_spent)} of{" "}
                  {formatCurrency(category.budget_amount)}
                </span>
                <span
                  className={`
                    font-medium tabular-nums
                    ${category.remaining < 0 ? "text-destructive" : category.remaining < category.budget_amount * 0.2 ? "text-spectral" : "text-emerald-400"}
                  `}
                  data-oid="4poox.k"
                >
                  {category.remaining >= 0
                    ? formatCurrency(category.remaining)
                    : `-${formatCurrency(Math.abs(category.remaining))}`}{" "}
                  left
                </span>
              </div>
              <ProgressBar
                value={category.actual_spent}
                max={category.budget_amount}
                size="sm"
                data-oid="k:qb2p-"
              />

              {!compact && category.expense_count > 0 && (
                <div
                  className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"
                  data-oid="6f4ldmi"
                >
                  <Receipt className="w-3 h-3" data-oid="lbg0cno" />
                  {category.expense_count} expense
                  {category.expense_count !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        </Link>

        {/* Expanded expenses section */}
        {expandable && isExpanded && expenses.length > 0 && (
          <div
            className="mt-4 pt-4 border-t border-border"
            data-oid="7ddzrj:"
          >
            <h4
              className="text-sm font-medium text-foreground mb-3"
              data-oid="xs33zgy"
            >
              Expenses ({expenses.length})
            </h4>
            <div className="space-y-2" data-oid="m6kpzpm">
              {expenses.slice(0, 5).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between py-2 px-3 bg-background/50 rounded text-sm"
                  data-oid="8x6ymol"
                >
                  <div className="flex-1 min-w-0" data-oid="v1od5lj">
                    <span
                      className="font-medium text-foreground"
                      data-oid="g0.mkyo"
                    >
                      {expense.vendor || "Unknown Vendor"}
                    </span>
                    {expense.memo && (
                      <p
                        className="text-muted-foreground text-xs truncate mt-0.5"
                        data-oid=":hr15r."
                      >
                        {expense.memo}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4" data-oid="witf3.2">
                    <span
                      className="font-medium tabular-nums text-foreground"
                      data-oid="qijkzhl"
                    >
                      {formatCurrency(expense.amount)}
                    </span>
                    <p className="text-xs text-muted-foreground" data-oid="6erj9ah">
                      {new Date(expense.expense_date).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </p>
                  </div>
                </div>
              ))}
              {expenses.length > 5 && (
                <Link
                  href={`/categories/${category.id}`}
                  className="block text-center py-2 text-sm text-spectral hover:text-foreground transition-colors"
                  data-oid="6j9:ea:"
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
