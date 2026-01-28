'use client';

import { Card, CardContent, ProgressBar } from '@/components/ui';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

/* ============================================
   BUDGET OVERVIEW CARD
   ============================================
   Displays total budget, actual spending, and remaining
   with Victorian-styled presentation and progress bar.
   ============================================ */

export interface BudgetOverviewCardProps {
  budget: number;
  allocated?: number;
  actual: number;
  remaining: number;
  className?: string;
}

export function BudgetOverviewCard({
  budget,
  allocated,
  actual,
  remaining,
  className,
}: BudgetOverviewCardProps) {
  const hasSetBudget = allocated !== undefined && allocated !== budget;
  const percentUsed = budget > 0 ? (actual / budget) * 100 : 0;
  const isOverBudget = actual > budget;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStatusColor = () => {
    if (isOverBudget) return 'text-ink-red';
    if (percentUsed >= 80) return 'text-ink-gold';
    return 'text-ink-green';
  };

  const getStatusText = () => {
    if (isOverBudget) return 'Over Budget';
    if (percentUsed >= 80) return 'Nearing Limit';
    return 'On Track';
  };

  return (
    <Card className={className} flourish elevated>
      <CardContent className="py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-wood-medium/10 text-wood-medium">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold text-wood-dark">
                Annual Budget
              </h2>
              <p className="text-sm text-sepia">FY 2026 Overview</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${getStatusColor()}`}>
            {isOverBudget ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )}
            <span>{getStatusText()}</span>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Total Budget */}
          <div className="text-center border-r border-wood-medium/20 pr-6">
            <div className="flex items-center justify-center gap-2 text-sepia mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">Total Budget</span>
            </div>
            <p className="font-serif text-3xl font-bold text-wood-dark tabular-nums">
              {formatCurrency(budget)}
            </p>
          </div>

          {/* Actual Spent */}
          <div className="text-center border-r border-wood-medium/20 pr-6">
            <div className="flex items-center justify-center gap-2 text-sepia mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Spent to Date</span>
            </div>
            <p className={`font-serif text-3xl font-bold tabular-nums ${isOverBudget ? 'text-ink-red' : 'text-ink-black'}`}>
              {formatCurrency(actual)}
            </p>
            <p className="text-xs text-sepia mt-1">
              {percentUsed.toFixed(1)}% of budget
            </p>
          </div>

          {/* Remaining */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-sepia mb-1">
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">Remaining</span>
            </div>
            <p className={`font-serif text-3xl font-bold tabular-nums ${getStatusColor()}`}>
              {formatCurrency(remaining)}
            </p>
            <p className="text-xs text-sepia mt-1">
              {(100 - percentUsed).toFixed(1)}% available
            </p>
          </div>
        </div>

        {/* Allocated indicator (when a total budget is set) */}
        {hasSetBudget && allocated !== undefined && (
          <div className="flex items-center justify-between text-sm px-1 mb-4">
            <span className="text-sepia">Allocated to events &amp; categories</span>
            <span className={allocated > budget ? 'text-ink-red font-medium' : 'text-wood-dark font-medium'}>
              {formatCurrency(allocated)} of {formatCurrency(budget)}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="pt-4 border-t border-wood-medium/20">
          <ProgressBar
            value={actual}
            max={budget}
            size="lg"
            showLabel
            labelFormat="both"
            animated={isOverBudget}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default BudgetOverviewCard;
