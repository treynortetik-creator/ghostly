'use client';

import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AssignmentSelector, type AssignmentOption } from './AssignmentSelector';

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
  status: 'pending' | 'accepted' | 'skipped' | 'replace';
}

interface TransactionReviewProps {
  transactions: ParsedTransaction[];
  assignmentOptions: AssignmentOption[];
  onUpdateTransaction: (id: string, updates: Partial<ParsedTransaction>) => void;
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
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'vendor'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Calculate summary stats
  const stats = useMemo(() => {
    const duplicates = transactions.filter((t) => t.isDuplicate);
    const withSuggestions = transactions.filter((t) => t.suggestedAssignment);
    const pending = transactions.filter((t) => t.status === 'pending');
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
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'vendor':
          comparison = a.vendor.localeCompare(b.vendor);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [transactions, sortBy, sortOrder]);

  const toggleSort = (column: 'date' | 'amount' | 'vendor') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
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

  const handleAssignmentChange = (id: string, assignment: AssignmentOption | null) => {
    onUpdateTransaction(id, { suggestedAssignment: assignment });
  };

  const handleStatusChange = (id: string, status: ParsedTransaction['status']) => {
    onUpdateTransaction(id, { status });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const SortIcon = ({ column }: { column: 'date' | 'amount' | 'vendor' }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3">
          <p className="text-xs text-sepia uppercase tracking-wider">Total</p>
          <p className="text-lg font-serif font-bold text-ink-black">
            {stats.total}
          </p>
        </div>
        <div className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3">
          <p className="text-xs text-sepia uppercase tracking-wider">Amount</p>
          <p className="text-lg font-serif font-bold text-ink-black">
            {formatCurrency(stats.totalAmount)}
          </p>
        </div>
        <div className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3">
          <p className="text-xs text-sepia uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-ink-gold" />
            AI Suggestions
          </p>
          <p className="text-lg font-serif font-bold text-ink-gold">
            {stats.withSuggestions}
          </p>
        </div>
        <div className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3">
          <p className="text-xs text-sepia uppercase tracking-wider flex items-center gap-1">
            <Copy className="w-3 h-3 text-ink-red" />
            Duplicates
          </p>
          <p className="text-lg font-serif font-bold text-ink-red">
            {stats.duplicates}
          </p>
        </div>
        <div className="bg-parchment-dark border border-wood-medium/30 rounded-lg p-3">
          <p className="text-xs text-sepia uppercase tracking-wider">Pending</p>
          <p className="text-lg font-serif font-bold text-sepia">
            {stats.pending}
          </p>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center gap-3 py-2">
        <Button variant="success" size="sm" onClick={onAcceptAll}>
          <CheckCircle className="w-4 h-4 mr-1" />
          Accept All Suggestions
        </Button>
        {stats.duplicates > 0 && (
          <Button variant="secondary" size="sm" onClick={onSkipDuplicates}>
            <XCircle className="w-4 h-4 mr-1" />
            Skip All Duplicates
          </Button>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-parchment-dark border border-wood-medium/30 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-wood-medium/10 border-b border-wood-medium/20">
                <th className="w-8 px-3 py-3" />
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-sepia uppercase tracking-wider cursor-pointer hover:text-wood-dark"
                  onClick={() => toggleSort('date')}
                >
                  <span className="flex items-center gap-1">
                    Date <SortIcon column="date" />
                  </span>
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-sepia uppercase tracking-wider cursor-pointer hover:text-wood-dark"
                  onClick={() => toggleSort('vendor')}
                >
                  <span className="flex items-center gap-1">
                    Vendor <SortIcon column="vendor" />
                  </span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold text-sepia uppercase tracking-wider cursor-pointer hover:text-wood-dark"
                  onClick={() => toggleSort('amount')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Amount <SortIcon column="amount" />
                  </span>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-sepia uppercase tracking-wider">
                  Assignment
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-sepia uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-sepia uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wood-medium/10">
              {sortedTransactions.map((transaction) => {
                const isExpanded = expandedRows.has(transaction.id);

                return (
                  <>
                    <tr
                      key={transaction.id}
                      className={cn(
                        'transition-colors',
                        transaction.isDuplicate && 'bg-ink-red/5',
                        transaction.status === 'skipped' && 'opacity-50',
                        transaction.status === 'accepted' && 'bg-ink-green/5'
                      )}
                    >
                      {/* Expand Toggle */}
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleExpanded(transaction.id)}
                          className="p-1 hover:bg-wood-medium/10 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-sepia" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-sepia" />
                          )}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-3 text-sm text-ink-black whitespace-nowrap">
                        {formatDate(transaction.date)}
                      </td>

                      {/* Vendor */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink-black truncate max-w-[200px]">
                            {transaction.vendor}
                          </span>
                          {transaction.isDuplicate && (
                            <span
                              className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-ink-red/10 text-ink-red border border-ink-red/30"
                              title="Potential duplicate"
                            >
                              <Copy className="w-3 h-3" />
                              Duplicate
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-3 text-sm text-right font-mono font-medium text-ink-black whitespace-nowrap">
                        {formatCurrency(transaction.amount)}
                      </td>

                      {/* Assignment */}
                      <td className="px-3 py-3 min-w-[250px]">
                        <AssignmentSelector
                          value={transaction.suggestedAssignment}
                          options={assignmentOptions}
                          onChange={(assignment) =>
                            handleAssignmentChange(transaction.id, assignment)
                          }
                          aiSuggested={transaction.suggestedAssignment !== null}
                          aiConfidence={transaction.aiConfidence ?? undefined}
                          disabled={transaction.status === 'skipped'}
                        />
                      </td>

                      {/* Status Indicator */}
                      <td className="px-3 py-3 text-center">
                        {transaction.status === 'accepted' && (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-green">
                            <CheckCircle className="w-4 h-4" />
                          </span>
                        )}
                        {transaction.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1 text-xs text-sepia">
                            <XCircle className="w-4 h-4" />
                          </span>
                        )}
                        {transaction.status === 'replace' && (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-gold">
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        )}
                        {transaction.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-xs text-sepia/50">
                            &mdash;
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleStatusChange(transaction.id, 'accepted')}
                            className={cn(
                              'p-1.5 rounded transition-colors',
                              transaction.status === 'accepted'
                                ? 'bg-ink-green/20 text-ink-green'
                                : 'hover:bg-ink-green/10 text-sepia hover:text-ink-green'
                            )}
                            title="Accept"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStatusChange(transaction.id, 'skipped')}
                            className={cn(
                              'p-1.5 rounded transition-colors',
                              transaction.status === 'skipped'
                                ? 'bg-sepia/20 text-sepia'
                                : 'hover:bg-sepia/10 text-sepia/50 hover:text-sepia'
                            )}
                            title="Skip"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          {transaction.isDuplicate && (
                            <button
                              onClick={() => handleStatusChange(transaction.id, 'replace')}
                              className={cn(
                                'p-1.5 rounded transition-colors',
                                transaction.status === 'replace'
                                  ? 'bg-ink-gold/20 text-ink-gold'
                                  : 'hover:bg-ink-gold/10 text-sepia/50 hover:text-ink-gold'
                              )}
                              title="Replace existing"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-wood-medium/5">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3">
                            {/* Memo */}
                            {transaction.memo && (
                              <div>
                                <span className="text-xs font-semibold text-sepia uppercase tracking-wider">
                                  Memo:
                                </span>
                                <p className="mt-1 text-sm text-ink-black">
                                  {transaction.memo}
                                </p>
                              </div>
                            )}

                            {/* Duplicate Info */}
                            {transaction.isDuplicate && transaction.duplicateOf && (
                              <div className="flex items-start gap-2 p-3 bg-ink-red/10 border border-ink-red/30 rounded">
                                <AlertTriangle className="w-4 h-4 text-ink-red shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-ink-red">
                                    Potential Duplicate Detected
                                  </p>
                                  <p className="text-xs text-ink-red/80 mt-1">
                                    Existing expense: {transaction.duplicateOf.vendor} -{' '}
                                    {formatCurrency(transaction.duplicateOf.amount)} on{' '}
                                    {formatDate(transaction.duplicateOf.date)}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* AI Suggestion Explanation */}
                            {transaction.suggestedAssignment && transaction.aiConfidence && (
                              <div className="flex items-start gap-2 p-3 bg-ink-gold/10 border border-ink-gold/30 rounded">
                                <Sparkles className="w-4 h-4 text-ink-gold shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-ink-gold">
                                    AI Suggestion
                                  </p>
                                  <p className="text-xs text-sepia mt-1">
                                    Based on vendor name and memo, this transaction appears to
                                    match &quot;{transaction.suggestedAssignment.name}&quot; with{' '}
                                    {Math.round(transaction.aiConfidence * 100)}% confidence.
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
