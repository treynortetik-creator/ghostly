"use client";

import Link from "next/link";
import { Calendar, Tag, FileText, CreditCard, PencilLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatDateMedium } from "@/lib/format";
import type { ExpenseWithRelations } from "@/types/database";

/* ============================================
   EXPENSE CARD COMPONENT
   ============================================
   Victorian-styled card showing expense summary
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
  manual: "bg-sepia/15 text-sepia border-sepia/30",
  brex: "bg-ink-green/15 text-ink-green border-ink-green/30",
  pdf: "bg-ink-gold/15 text-ink-gold border-ink-gold/30",
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
      data-oid="05swwm6"
    >
      <CardContent className={compact ? "py-3" : "py-4"} data-oid="2tvi7r0">
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-4"
          data-oid="71herlg"
        >
          {/* Left section: Vendor and memo */}
          <div className="flex-1 min-w-0" data-oid="hw6roks">
            <div
              className="flex flex-wrap items-center gap-2 mb-1"
              data-oid="z.16l5v"
            >
              <h3
                className="font-serif font-semibold text-wood-dark truncate"
                data-oid="-t-vyib"
              >
                {expense.vendor || "Unknown Vendor"}
              </h3>
              {/* Source type badge */}
              <span
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border
                  ${sourceBadgeColors[expense.source_type]}
                `}
                data-oid="f:35ea4"
              >
                <SourceIcon className="w-3 h-3" data-oid="wuxq:7p" />
                {sourceLabels[expense.source_type]}
              </span>
            </div>

            {/* Memo */}
            {!compact && expense.memo && (
              <p
                className="text-sm text-sepia truncate mt-1"
                data-oid="bh-cabv"
              >
                {expense.memo}
              </p>
            )}

            {/* Meta info: date and target */}
            <div
              className="flex flex-wrap items-center gap-3 mt-2 text-sm text-sepia"
              data-oid="bv7f9eu"
            >
              <span
                className="inline-flex items-center gap-1"
                data-oid="t0m7ie4"
              >
                <Calendar className="w-3.5 h-3.5" data-oid="4vpe0ms" />
                {formatDateMedium(expense.expense_date)}
              </span>
              <span className="text-wood-medium/30" data-oid="15ckp9r">
                |
              </span>
              <Link
                href={targetLink}
                className="inline-flex items-center gap-1 hover:text-ink-gold transition-colors"
                data-oid="diit:b9"
              >
                <TargetIcon className="w-3.5 h-3.5" data-oid="5f_0kzq" />
                <span className="truncate max-w-[200px]" data-oid="ubx2t3l">
                  {expense.target_name}
                </span>
                <span className="text-xs text-sepia/60" data-oid="573v4_q">
                  ({expense.target_type === "event" ? "Event" : "Category"})
                </span>
              </Link>
            </div>
          </div>

          {/* Right section: Amount and actions */}
          <div className="flex items-center gap-4" data-oid="e36ar4c">
            <div className="text-right" data-oid="yfcaeu9">
              <span
                className="font-serif text-lg font-semibold tabular-nums text-wood-dark"
                data-oid="oea:hnb"
              >
                {formatCurrency(expense.amount)}
              </span>
            </div>

            {/* Action buttons */}
            {(onEdit || onDelete) && (
              <div
                className="flex items-center gap-2 border-l border-wood-medium/20 pl-4"
                data-oid="1dw6vtw"
              >
                {onEdit && (
                  <button
                    onClick={() => onEdit(expense)}
                    className="p-2 rounded-md text-sepia hover:text-ink-gold hover:bg-ink-gold/10 transition-colors"
                    aria-label="Edit expense"
                    data-oid="nqc3egk"
                  >
                    <PencilLine className="w-4 h-4" data-oid="vfd4do3" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(expense)}
                    className="p-2 rounded-md text-sepia hover:text-ink-red hover:bg-ink-red/10 transition-colors"
                    aria-label="Delete expense"
                    data-oid="xe6qjzk"
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
                      data-oid="2rxxz69"
                    >
                      <path d="M3 6h18" data-oid="zsf18f." />
                      <path
                        d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
                        data-oid="721rca6"
                      />
                      <path
                        d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
                        data-oid="mnvz7fj"
                      />
                      <line
                        x1="10"
                        y1="11"
                        x2="10"
                        y2="17"
                        data-oid="qhhbcai"
                      />
                      <line
                        x1="14"
                        y1="11"
                        x2="14"
                        y2="17"
                        data-oid="vj_udmj"
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
