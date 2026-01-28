'use client';

import { useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  DollarSign,
  Calendar,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ParsedTransaction } from './TransactionReview';

/* ============================================
   IMPORT CONFIRMATION COMPONENT
   ============================================
   Summary view before final import.
   Shows what will be imported, skipped, or replaced.
   ============================================ */

interface ImportConfirmationProps {
  transactions: ParsedTransaction[];
  onConfirm: () => void;
  onBack: () => void;
  isLoading?: boolean;
  className?: string;
}

export function ImportConfirmation({
  transactions,
  onConfirm,
  onBack,
  isLoading = false,
  className,
}: ImportConfirmationProps) {
  // Calculate summary
  const summary = useMemo(() => {
    const accepted = transactions.filter((t) => t.status === 'accepted');
    const skipped = transactions.filter((t) => t.status === 'skipped');
    const replacing = transactions.filter((t) => t.status === 'replace');
    const pending = transactions.filter((t) => t.status === 'pending');
    const withoutAssignment = accepted.filter((t) => !t.suggestedAssignment);

    const acceptedAmount = accepted.reduce((sum, t) => sum + t.amount, 0);
    const replacingAmount = replacing.reduce((sum, t) => sum + t.amount, 0);

    // Group by assignment
    const byEvent: Record<string, { name: string; count: number; amount: number }> = {};
    const byCategory: Record<string, { name: string; count: number; amount: number }> = {};

    accepted.forEach((t) => {
      if (t.suggestedAssignment) {
        const { id, name, type } = t.suggestedAssignment;
        const target = type === 'event' ? byEvent : byCategory;
        if (!target[id]) {
          target[id] = { name, count: 0, amount: 0 };
        }
        target[id].count++;
        target[id].amount += t.amount;
      }
    });

    return {
      accepted,
      skipped,
      replacing,
      pending,
      withoutAssignment,
      acceptedAmount,
      replacingAmount,
      byEvent: Object.values(byEvent),
      byCategory: Object.values(byCategory),
    };
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const canConfirm =
    summary.accepted.length > 0 &&
    summary.withoutAssignment.length === 0 &&
    summary.pending.length === 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-ink-green/5 border-ink-green/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ink-green/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-ink-green" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold text-ink-green">
                  {summary.accepted.length}
                </p>
                <p className="text-xs text-sepia">To Import</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-ink-gold/5 border-ink-gold/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ink-gold/20 rounded-lg">
                <ArrowRight className="w-5 h-5 text-ink-gold" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold text-ink-gold">
                  {summary.replacing.length}
                </p>
                <p className="text-xs text-sepia">To Replace</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-sepia/5 border-sepia/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sepia/20 rounded-lg">
                <XCircle className="w-5 h-5 text-sepia" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold text-sepia">
                  {summary.skipped.length}
                </p>
                <p className="text-xs text-sepia">To Skip</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-wood-medium/5 border-wood-medium/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-wood-medium/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-wood-medium" />
              </div>
              <div>
                <p className="text-2xl font-serif font-bold text-wood-dark">
                  {formatCurrency(summary.acceptedAmount + summary.replacingAmount)}
                </p>
                <p className="text-xs text-sepia">Total Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {summary.withoutAssignment.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-ink-red/10 border border-ink-red/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-ink-red shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-ink-red">Missing Assignments</p>
            <p className="text-sm text-ink-red/80 mt-1">
              {summary.withoutAssignment.length} transaction(s) are marked to import
              but have no event or category assigned. Please go back and assign them
              or mark them as skipped.
            </p>
          </div>
        </div>
      )}

      {summary.pending.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-ink-gold/10 border border-ink-gold/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-ink-gold shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-ink-gold">Pending Decisions</p>
            <p className="text-sm text-sepia mt-1">
              {summary.pending.length} transaction(s) still need to be marked as
              accepted, skipped, or replaced. Please go back and make a decision for
              each.
            </p>
          </div>
        </div>
      )}

      {/* Breakdown by Assignment */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* By Event */}
        {summary.byEvent.length > 0 && (
          <Card>
            <CardHeader divider>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4 text-ink-gold" />
                By Event
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0">
              <div className="divide-y divide-wood-medium/10">
                {summary.byEvent.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-black">{item.name}</p>
                      <p className="text-xs text-sepia">{item.count} transaction(s)</p>
                    </div>
                    <p className="text-sm font-mono font-medium text-ink-black">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* By Category */}
        {summary.byCategory.length > 0 && (
          <Card>
            <CardHeader divider>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="w-4 h-4 text-ink-green" />
                By Category
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0">
              <div className="divide-y divide-wood-medium/10">
                {summary.byCategory.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-black">{item.name}</p>
                      <p className="text-xs text-sepia">{item.count} transaction(s)</p>
                    </div>
                    <p className="text-sm font-mono font-medium text-ink-black">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transaction List Preview */}
      {summary.accepted.length > 0 && (
        <Card>
          <CardHeader divider>
            <CardTitle className="text-base">Transactions to Import</CardTitle>
          </CardHeader>
          <CardContent className="py-0 max-h-64 overflow-y-auto">
            <div className="divide-y divide-wood-medium/10">
              {summary.accepted.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-black truncate">
                      {t.vendor}
                    </p>
                    <p className="text-xs text-sepia">
                      {new Date(t.date).toLocaleDateString()} &middot;{' '}
                      {t.suggestedAssignment?.name || 'Unassigned'}
                    </p>
                  </div>
                  <p className="text-sm font-mono font-medium text-ink-black ml-4">
                    {formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
              {summary.accepted.length > 10 && (
                <div className="py-3 text-center text-sm text-sepia">
                  ... and {summary.accepted.length - 10} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardFooter className="flex items-center justify-between gap-4">
          <Button variant="secondary" onClick={onBack} disabled={isLoading}>
            Back to Review
          </Button>
          <Button
            variant="success"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={!canConfirm || isLoading}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirm Import ({summary.accepted.length + summary.replacing.length} items)
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ImportConfirmation;
