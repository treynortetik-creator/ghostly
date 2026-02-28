"use client";

import Link from "next/link";
import { Calendar, Tag, FileText, CreditCard, PencilLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatDateMedium } from "@/lib/format";
import type { ExpenseWithRelations } from "@/types/database";

/* ============================================
   EXPENSE CARD COMPONENT
   ============================================
   Ghostly-themed card showing expense summary
   with vendor, amount, date, and target info.
   ============================================ */

export interface ExpenseCardProps {
  /** Expense data with relations */
  expense: ExpenseWithRelations;
  /** Show compact version */
  compact?: boolean;
  /** Callback when edit is clicked */
  onEdit?: (expense: ExpenseWithRelations) => void;
  /** Callback when delete is clicked */
  onDelete?: (expense: ExpenseWithRelations) => void;
}

const sourceIcons: Record<string, typeof CreditCard> = {
  manual: PencilLine,
  brex: CreditCard,
  pdf: FileText,
};

const sourceLabels: Record<string, string> = {
  manual: "Manual Entry",
  brex: "Brex Import",
  pdf: "PDF Upload",
};

const sourceBadgeColors: Record<string, string> = {
  manual: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  brex: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  pdf: "bg-spectral/10 text-spectral border-spectral",
};

export function ExpenseCard({
  expense,
  compact = false,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const SourceIcon = sourceIcons[expense.source_type] || PencilLine;
  const TargetIcon = expense.target_type === "event" ? Calendar : Tag;

  // Link to the appropriate detail page
  const targetLink =
    expense.target_type === "event"
      ? `/events/${expense.event_id}`
      : `/categories/${expense.category_id}`;

  return (
    <Card
      className="transition-all duration-200 hover:shadow-md"
     
    >
      <CardContent className={compact ? "py-3" : "py-4"}>
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-4"
         
        >
          {/* Left section: Vendor and memo */}
          <div className="flex-1 min-w-0">
            <div
              className="flex flex-wrap items-center gap-2 mb-1"
             
            >
              <h3
                className="font-semibold text-foreground truncate"
               
              >
                {expense.vendor || "Unknown Vendor"}
              </h3>
              {/* Source type badge */}
              <span
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border
                  ${sourceBadgeColors[expense.source_type]}
                `}
               
              >
                <SourceIcon className="w-3 h-3" />
                {sourceLabels[expense.source_type]}
              </span>
            </div>

            {/* Memo */}
            {!compact && expense.memo && (
              <p
                className="text-sm text-muted-foreground truncate mt-1"
               
              >
                {expense.memo}
              </p>
            )}

            {/* Meta info: date and target */}
            <div
              className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground"
             
            >
              <span
                className="inline-flex items-center gap-1"
               
              >
                <Calendar className="w-3.5 h-3.5" />
                {formatDateMedium(expense.expense_date)}
              </span>
              <span className="text-muted-foreground/30">
                |
              </span>
              <Link
                href={targetLink}
                className="inline-flex items-center gap-1 hover:text-spectral transition-colors"
               
              >
                <TargetIcon className="w-3.5 h-3.5" />
                <span className="truncate max-w-[200px]">
                  {expense.target_name}
                </span>
                <span className="text-xs text-muted-foreground/60">
                  ({expense.target_type === "event" ? "Event" : "Category"})
                </span>
              </Link>
            </div>
          </div>

          {/* Right section: Amount and actions */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span
                className="text-lg font-semibold tabular-nums text-foreground"
               
              >
                {formatCurrency(expense.amount)}
              </span>
            </div>

            {/* Action buttons */}
            {(onEdit || onDelete) && (
              <div
                className="flex items-center gap-2 border-l border-border pl-4"
               
              >
                {onEdit && (
                  <button
                    onClick={() => onEdit(expense)}
                    className="p-2 rounded-md text-muted-foreground hover:text-spectral hover:bg-spectral/10 transition-colors"
                    aria-label="Edit expense"
                   
                  >
                    <PencilLine className="w-4 h-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(expense)}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-red-400/10 transition-colors"
                    aria-label="Delete expense"
                   
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                     
                    >
                      <path d="M3 6h18" />
                      <path
                        d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
                       
                      />
                      <path
                        d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                       
                      />
                      <line
                        x1="10"
                        y1="11"
                        x2="10"
                        y2="17"
                       
                      />
                      <line
                        x1="14"
                        y1="11"
                        x2="14"
                        y2="17"
                       
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ExpenseCard;
