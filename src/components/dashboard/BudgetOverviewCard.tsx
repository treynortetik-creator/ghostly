"use client";

import { Card, CardContent, ProgressBar } from "@/components/ui";
import { DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";

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
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStatusColor = () => {
    if (isOverBudget) return "text-ink-red";
    if (percentUsed >= 80) return "text-ink-gold";
    return "text-ink-green";
  };

  const getStatusText = () => {
    if (isOverBudget) return "Over Budget";
    if (percentUsed >= 80) return "Nearing Limit";
    return "On Track";
  };

  return (
    <Card className={className} flourish elevated data-oid="f4-h8cs">
      <CardContent className="py-6" data-oid="7jd9hm1">
        {/* Header */}
        <div
          className="flex items-center justify-between mb-6"
          data-oid="n3l6npw"
        >
          <div className="flex items-center gap-3" data-oid="p-oacfj">
            <div
              className="p-3 rounded-lg bg-wood-medium/10 text-wood-medium"
              data-oid="i5mup12"
            >
              <Wallet className="w-6 h-6" data-oid="352x40s" />
            </div>
            <div data-oid="jb2-.3f">
              <h2
                className="font-serif text-2xl font-semibold text-wood-dark"
                data-oid="uh.j-3i"
              >
                Annual Budget
              </h2>
              <p className="text-sm text-sepia" data-oid="cb94_wh">
                FY 2026 Overview
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-1.5 text-sm font-medium ${getStatusColor()}`}
            data-oid="xsm-c6j"
          >
            {isOverBudget ? (
              <TrendingDown className="w-4 h-4" data-oid=":dn2947" />
            ) : (
              <TrendingUp className="w-4 h-4" data-oid="c26vl_r" />
            )}
            <span data-oid="-5hg515">{getStatusText()}</span>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-6" data-oid="lv6wds1">
          {/* Total Budget */}
          <div
            className="text-center border-r border-wood-medium/20 pr-6"
            data-oid="6itcokl"
          >
            <div
              className="flex items-center justify-center gap-2 text-sepia mb-1"
              data-oid="zdegs-4"
            >
              <DollarSign className="w-4 h-4" data-oid="0zru-kc" />
              <span className="text-sm font-medium" data-oid="t0xdu2y">
                Total Budget
              </span>
            </div>
            <p
              className="font-serif text-3xl font-bold text-wood-dark tabular-nums"
              data-oid="vcg8m1t"
            >
              {formatCurrency(budget)}
            </p>
          </div>

          {/* Actual Spent */}
          <div
            className="text-center border-r border-wood-medium/20 pr-6"
            data-oid="luetqfp"
          >
            <div
              className="flex items-center justify-center gap-2 text-sepia mb-1"
              data-oid="z.qowni"
            >
              <TrendingUp className="w-4 h-4" data-oid=":e57ftm" />
              <span className="text-sm font-medium" data-oid=":ybkq1h">
                Spent to Date
              </span>
            </div>
            <p
              className={`font-serif text-3xl font-bold tabular-nums ${isOverBudget ? "text-ink-red" : "text-ink-black"}`}
              data-oid="8f5qzd5"
            >
              {formatCurrency(actual)}
            </p>
            <p className="text-xs text-sepia mt-1" data-oid="w.96:gm">
              {percentUsed.toFixed(1)}% of budget
            </p>
          </div>

          {/* Remaining */}
          <div className="text-center" data-oid="pscbi9j">
            <div
              className="flex items-center justify-center gap-2 text-sepia mb-1"
              data-oid="68kzta7"
            >
              <Wallet className="w-4 h-4" data-oid="hg5ypb9" />
              <span className="text-sm font-medium" data-oid="xvq_zgz">
                Remaining
              </span>
            </div>
            <p
              className={`font-serif text-3xl font-bold tabular-nums ${getStatusColor()}`}
              data-oid="l.f9w.5"
            >
              {formatCurrency(remaining)}
            </p>
            <p className="text-xs text-sepia mt-1" data-oid="01a_0gv">
              {(100 - percentUsed).toFixed(1)}% available
            </p>
          </div>
        </div>

        {/* Allocated indicator (when a total budget is set) */}
        {hasSetBudget && allocated !== undefined && (
          <div
            className="flex items-center justify-between text-sm px-1 mb-4"
            data-oid="bg1pnwb"
          >
            <span className="text-sepia" data-oid="j8hp-1l">
              Allocated to events &amp; categories
            </span>
            <span
              className={
                allocated > budget
                  ? "text-ink-red font-medium"
                  : "text-wood-dark font-medium"
              }
              data-oid="exkt5c1"
            >
              {formatCurrency(allocated)} of {formatCurrency(budget)}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="pt-4 border-t border-wood-medium/20" data-oid="k2oulv4">
          <ProgressBar
            value={actual}
            max={budget}
            size="lg"
            showLabel
            labelFormat="both"
            animated={isOverBudget}
            data-oid="y-405sw"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default BudgetOverviewCard;
