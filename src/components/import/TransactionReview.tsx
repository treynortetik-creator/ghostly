"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  AssignmentSelector,
  type AssignmentOption,
} from "./AssignmentSelector";

/* ============================================
   TRANSACTION REVIEW COMPONENT
   ============================================
   Table showing parsed transactions with AI
   suggestions and duplicate detection.
   Allows editing assignments before import.
   ============================================ */

export interface ParsedTransaction {
  id: string;
  date: string;
  amount: number;
  vendor: string;
  memo: string | null;
  suggestedAssignment: AssignmentOption | null;
  aiConfidence: number | null;
  isDuplicate: boolean;
  duplicateOf?: {
    id: string;
    date: string;
    vendor: string;
    amount: number;
  };
  status: "pending" | "accepted" | "skipped" | "replace";
}

interface TransactionReviewProps {
  transactions: ParsedTransaction[];
  assignmentOptions: AssignmentOption[];
  onUpdateTransaction: (
    id: string,
    updates: Partial<ParsedTransaction>,
  ) => void;
  onAcceptAll: () => void;
  onSkipDuplicates: () => void;
  className?: string;
}

export function TransactionReview({
  transactions,
  assignmentOptions,
  onUpdateTransaction,
  onAcceptAll,
  onSkipDuplicates,
  className,
}: TransactionReviewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"date" | "amount" | "vendor">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Calculate summary stats
  const stats = useMemo(() => {
    const duplicates = transactions.filter((t) => t.isDuplicate);
    const withSuggestions = transactions.filter((t) => t.suggestedAssignment);
    const pending = transactions.filter((t) => t.status === "pending");
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      total: transactions.length,
      duplicates: duplicates.length,
      withSuggestions: withSuggestions.length,
      pending: pending.length,
      totalAmount,
    };
  }, [transactions]);

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison = a.date.localeCompare(b.date);
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
        case "vendor":
          comparison = a.vendor.localeCompare(b.vendor);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [transactions, sortBy, sortOrder]);

  const toggleSort = (column: "date" | "amount" | "vendor") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleAssignmentChange = (
    id: string,
    assignment: AssignmentOption | null,
  ) => {
    onUpdateTransaction(id, { suggestedAssignment: assignment });
  };

  const handleStatusChange = (
    id: string,
    status: ParsedTransaction["status"],
  ) => {
    onUpdateTransaction(id, { status });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const SortIcon = ({ column }: { column: "date" | "amount" | "vendor" }) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-3 h-3" data-oid="ylksn53" />
    ) : (
      <ChevronDown className="w-3 h-3" data-oid="5v4bvf:" />
    );
  };

  return (
    <div className={cn("space-y-4", className)} data-oid="5tztqak">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-oid="0hz.twu">
        <div
          className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3"
          data-oid="uu81xbx"
        >
          <p
            className="text-xs text-sepia uppercase tracking-wider"
            data-oid="8sfl9df"
          >
            Total
          </p>
          <p
            className="text-lg font-serif font-bold text-ink-black"
            data-oid="-7j8dc4"
          >
            {stats.total}
          </p>
        </div>
        <div
          className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3"
          data-oid="42w_46b"
        >
          <p
            className="text-xs text-sepia uppercase tracking-wider"
            data-oid="3hdydsp"
          >
            Amount
          </p>
          <p
            className="text-lg font-serif font-bold text-ink-black"
            data-oid="719ofze"
          >
            {formatCurrency(stats.totalAmount)}
          </p>
        </div>
        <div
          className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3"
          data-oid="2.vbacc"
        >
          <p
            className="text-xs text-sepia uppercase tracking-wider flex items-center gap-1"
            data-oid="dipjoq7"
          >
            <Sparkles className="w-3 h-3 text-ink-gold" data-oid="13vgffl" />
            AI Suggestions
          </p>
          <p
            className="text-lg font-serif font-bold text-ink-gold"
            data-oid="m6gdu-n"
          >
            {stats.withSuggestions}
          </p>
        </div>
        <div
          className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3"
          data-oid="xoi666f"
        >
          <p
            className="text-xs text-sepia uppercase tracking-wider flex items-center gap-1"
            data-oid="ycjj8ce"
          >
            <Copy className="w-3 h-3 text-ink-red" data-oid="wo2gjtd" />
            Duplicates
          </p>
          <p
            className="text-lg font-serif font-bold text-ink-red"
            data-oid="kn.lnhv"
          >
            {stats.duplicates}
          </p>
        </div>
        <div
          className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3"
          data-oid="6j_gzy4"
        >
          <p
            className="text-xs text-sepia uppercase tracking-wider"
            data-oid=".-.e6zz"
          >
            Pending
          </p>
          <p
            className="text-lg font-serif font-bold text-sepia"
            data-oid="ojs8qmw"
          >
            {stats.pending}
          </p>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center gap-3 py-2" data-oid="gw1j:yf">
        <Button
          variant="success"
          size="sm"
          onClick={onAcceptAll}
          data-oid="s.zn36g"
        >
          <CheckCircle className="w-4 h-4 mr-1" data-oid=":y5sz1h" />
          Accept All Suggestions
        </Button>
        {stats.duplicates > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onSkipDuplicates}
            data-oid="csyctq4"
          >
            <XCircle className="w-4 h-4 mr-1" data-oid="_9cx.dw" />
            Skip All Duplicates
          </Button>
        )}
      </div>

      {/* Transactions Table */}
      <div
        className="bg-parchment-dark border border-wood-medium/30 rounded-lg overflow-hidden"
        data-oid="rfdorks"
      >
        <div className="overflow-x-auto" data-oid="lov7jm:">
          <table className="w-full" data-oid="l.mgjog">
            <thead data-oid="j21lyr3">
              <tr
                className="bg-wood-medium/10 border-b border-wood-medium/20"
                data-oid="mf2j57a"
              >
                <th className="w-8 px-3 py-3" data-oid="d-6ojpi" />
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-sepia uppercase tracking-wider cursor-pointer hover:text-wood-dark"
                  onClick={() => toggleSort("date")}
                  data-oid="6zn7p2l"
                >
                  <span className="flex items-center gap-1" data-oid="65ytki5">
                    Date <SortIcon column="date" data-oid="571x079" />
                  </span>
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-sepia uppercase tracking-wider cursor-pointer hover:text-wood-dark"
                  onClick={() => toggleSort("vendor")}
                  data-oid=":lhi-ez"
                >
                  <span className="flex items-center gap-1" data-oid="ue.311t">
                    Vendor <SortIcon column="vendor" data-oid="2v2qg3_" />
                  </span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold text-sepia uppercase tracking-wider cursor-pointer hover:text-wood-dark"
                  onClick={() => toggleSort("amount")}
                  data-oid=":1.3diu"
                >
                  <span
                    className="flex items-center justify-end gap-1"
                    data-oid="czv25.i"
                  >
                    Amount <SortIcon column="amount" data-oid="e-fswbg" />
                  </span>
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-sepia uppercase tracking-wider"
                  data-oid="xx88n:7"
                >
                  Assignment
                </th>
                <th
                  className="px-3 py-3 text-center text-xs font-semibold text-sepia uppercase tracking-wider"
                  data-oid="4a6wz1."
                >
                  Status
                </th>
                <th
                  className="px-3 py-3 text-center text-xs font-semibold text-sepia uppercase tracking-wider"
                  data-oid="ry7mb74"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody
              className="divide-y divide-wood-medium/10"
              data-oid="w3ui587"
            >
              {sortedTransactions.map((transaction) => {
                const isExpanded = expandedRows.has(transaction.id);

                return (
                  <>
                    <tr
                      key={transaction.id}
                      className={cn(
                        "transition-colors",
                        transaction.isDuplicate && "bg-ink-red/5",
                        transaction.status === "skipped" && "opacity-50",
                        transaction.status === "accepted" && "bg-ink-green/5",
                      )}
                      data-oid="li52rv2"
                    >
                      {/* Expand Toggle */}
                      <td className="px-3 py-3" data-oid="jarqix1">
                        <button
                          onClick={() => toggleExpanded(transaction.id)}
                          className="p-1 hover:bg-wood-medium/10 rounded transition-colors"
                          data-oid="utgu3cw"
                        >
                          {isExpanded ? (
                            <ChevronUp
                              className="w-4 h-4 text-sepia"
                              data-oid="w3ppumf"
                            />
                          ) : (
                            <ChevronDown
                              className="w-4 h-4 text-sepia"
                              data-oid="98hab7y"
                            />
                          )}
                        </button>
                      </td>

                      {/* Date */}
                      <td
                        className="px-3 py-3 text-sm text-ink-black whitespace-nowrap"
                        data-oid="df_1luc"
                      >
                        {formatDate(transaction.date)}
                      </td>

                      {/* Vendor */}
                      <td className="px-3 py-3" data-oid="t4-83gy">
                        <div
                          className="flex items-center gap-2"
                          data-oid="r1b9of2"
                        >
                          <span
                            className="text-sm font-medium text-ink-black truncate max-w-[200px]"
                            data-oid="l9y54am"
                          >
                            {transaction.vendor}
                          </span>
                          {transaction.isDuplicate && (
                            <span
                              className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-ink-red/10 text-ink-red border border-ink-red/30"
                              title="Potential duplicate"
                              data-oid="m4_ha4m"
                            >
                              <Copy className="w-3 h-3" data-oid="9_u1sro" />
                              Duplicate
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td
                        className="px-3 py-3 text-sm text-right font-mono font-medium text-ink-black whitespace-nowrap"
                        data-oid=":t54vmq"
                      >
                        {formatCurrency(transaction.amount)}
                      </td>

                      {/* Assignment */}
                      <td
                        className="px-3 py-3 min-w-[250px]"
                        data-oid="gkfxi5b"
                      >
                        <AssignmentSelector
                          value={transaction.suggestedAssignment}
                          options={assignmentOptions}
                          onChange={(assignment) =>
                            handleAssignmentChange(transaction.id, assignment)
                          }
                          aiSuggested={transaction.suggestedAssignment !== null}
                          aiConfidence={transaction.aiConfidence ?? undefined}
                          disabled={transaction.status === "skipped"}
                          data-oid="214u887"
                        />
                      </td>

                      {/* Status Indicator */}
                      <td className="px-3 py-3 text-center" data-oid="p:kt-:c">
                        {transaction.status === "accepted" && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-ink-green"
                            data-oid="xq9kcnl"
                          >
                            <CheckCircle
                              className="w-4 h-4"
                              data-oid="n1f0npt"
                            />
                          </span>
                        )}
                        {transaction.status === "skipped" && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-sepia"
                            data-oid="4r0bod7"
                          >
                            <XCircle className="w-4 h-4" data-oid="muye6o." />
                          </span>
                        )}
                        {transaction.status === "replace" && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-ink-gold"
                            data-oid="fyu4-q_"
                          >
                            <ArrowRight
                              className="w-4 h-4"
                              data-oid="byfbu-y"
                            />
                          </span>
                        )}
                        {transaction.status === "pending" && (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-sepia/50"
                            data-oid="953ay-f"
                          >
                            &mdash;
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3" data-oid="xw9fuit">
                        <div
                          className="flex items-center justify-center gap-1"
                          data-oid="1r_:6:3"
                        >
                          <button
                            onClick={() =>
                              handleStatusChange(transaction.id, "accepted")
                            }
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              transaction.status === "accepted"
                                ? "bg-ink-green/20 text-ink-green"
                                : "hover:bg-ink-green/10 text-sepia hover:text-ink-green",
                            )}
                            title="Accept"
                            aria-label="Accept transaction"
                            data-oid="vmbco7w"
                          >
                            <CheckCircle
                              className="w-4 h-4"
                              data-oid="ow:v2p2"
                            />
                          </button>
                          <button
                            onClick={() =>
                              handleStatusChange(transaction.id, "skipped")
                            }
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              transaction.status === "skipped"
                                ? "bg-sepia/20 text-sepia"
                                : "hover:bg-sepia/10 text-sepia/50 hover:text-sepia",
                            )}
                            title="Skip"
                            aria-label="Skip transaction"
                            data-oid="0ij7_9r"
                          >
                            <XCircle className="w-4 h-4" data-oid="7wpff0n" />
                          </button>
                          {transaction.isDuplicate && (
                            <button
                              onClick={() =>
                                handleStatusChange(transaction.id, "replace")
                              }
                              className={cn(
                                "p-1.5 rounded transition-colors",
                                transaction.status === "replace"
                                  ? "bg-ink-gold/20 text-ink-gold"
                                  : "hover:bg-ink-gold/10 text-sepia/50 hover:text-ink-gold",
                              )}
                              title="Replace existing"
                              aria-label="Replace existing expense"
                              data-oid="pl8kxyx"
                            >
                              <ArrowRight
                                className="w-4 h-4"
                                data-oid="s.45lj-"
                              />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-wood-medium/5" data-oid="yq_-q81">
                        <td
                          colSpan={7}
                          className="px-6 py-4"
                          data-oid="l98tihk"
                        >
                          <div className="space-y-3" data-oid="l1_2n89">
                            {/* Memo */}
                            {transaction.memo && (
                              <div data-oid="glvoy3v">
                                <span
                                  className="text-xs font-semibold text-sepia uppercase tracking-wider"
                                  data-oid="n.fewwb"
                                >
                                  Memo:
                                </span>
                                <p
                                  className="mt-1 text-sm text-ink-black"
                                  data-oid="srykxxi"
                                >
                                  {transaction.memo}
                                </p>
                              </div>
                            )}

                            {/* Duplicate Info */}
                            {transaction.isDuplicate &&
                              transaction.duplicateOf && (
                                <div
                                  className="flex items-start gap-2 p-3 bg-ink-red/10 border border-ink-red/30 rounded"
                                  data-oid="81z90ee"
                                >
                                  <AlertTriangle
                                    className="w-4 h-4 text-ink-red shrink-0 mt-0.5"
                                    data-oid="r5..tjp"
                                  />
                                  <div data-oid="mge:mlt">
                                    <p
                                      className="text-sm font-medium text-ink-red"
                                      data-oid="_tcurqv"
                                    >
                                      Potential Duplicate Detected
                                    </p>
                                    <p
                                      className="text-xs text-ink-red/80 mt-1"
                                      data-oid="jg_lj5n"
                                    >
                                      Existing expense:{" "}
                                      {transaction.duplicateOf.vendor} -{" "}
                                      {formatCurrency(
                                        transaction.duplicateOf.amount,
                                      )}{" "}
                                      on{" "}
                                      {formatDate(transaction.duplicateOf.date)}
                                    </p>
                                  </div>
                                </div>
                              )}

                            {/* AI Suggestion Explanation */}
                            {transaction.suggestedAssignment &&
                              transaction.aiConfidence && (
                                <div
                                  className="flex items-start gap-2 p-3 bg-ink-gold/10 border border-ink-gold/30 rounded"
                                  data-oid="y0ixng1"
                                >
                                  <Sparkles
                                    className="w-4 h-4 text-ink-gold shrink-0 mt-0.5"
                                    data-oid="0_pu949"
                                  />
                                  <div data-oid="fr-x4ob">
                                    <p
                                      className="text-sm font-medium text-ink-gold"
                                      data-oid="a3h995f"
                                    >
                                      AI Suggestion
                                    </p>
                                    <p
                                      className="text-xs text-sepia mt-1"
                                      data-oid="ix17px9"
                                    >
                                      Based on vendor name and memo, this
                                      transaction appears to match &quot;
                                      {transaction.suggestedAssignment.name}
                                      &quot; with{" "}
                                      {Math.round(
                                        transaction.aiConfidence * 100,
                                      )}
                                      % confidence.
                                    </p>
                                  </div>
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TransactionReview;
