"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  ProgressBar,
} from "@/components/ui";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import { Calendar, Clock } from "lucide-react";
import type { QuarterType } from "@/types/database";

/* ============================================
   QUARTER SUMMARY
   ============================================
   Displays budget breakdown by quarter with
   Ghostly-themed timeline and progress bars.
   ============================================ */

export interface QuarterData {
  quarter: QuarterType;
  budget: number;
  actual: number;
}

export interface QuarterSummaryProps {
  data: QuarterData[];
  className?: string;
}

// Quarter display configuration
const quarterConfig: Record<
  QuarterType,
  { label: string; months: string; color: string }
> = {
  Q1: {
    label: "Q1",
    months: "Jan - Mar",
    color: "bg-emerald-400",
  },
  Q2: {
    label: "Q2",
    months: "Apr - Jun",
    color: "bg-spectral",
  },
  Q3: {
    label: "Q3",
    months: "Jul - Sep",
    color: "bg-ghost-light",
  },
  Q4: {
    label: "Q4",
    months: "Oct - Dec",
    color: "bg-red-400",
  },
  TBD: {
    label: "TBD",
    months: "Unscheduled",
    color: "bg-muted-foreground",
  },
};

function QuarterCard({ data }: { data: QuarterData }) {
  const config = quarterConfig[data.quarter];
  const percentage = data.budget > 0 ? (data.actual / data.budget) * 100 : 0;
  const remaining = data.budget - data.actual;
  const isOverBudget = data.actual > data.budget;

  const getStatusColor = () => {
    if (isOverBudget) return "text-destructive";
    if (percentage >= 80) return "text-spectral";
    return "text-emerald-400";
  };

  // Skip quarters with no budget
  if (data.budget === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Quarter Badge */}
      <div className="absolute -top-3 left-4 z-10">
        <div
          className={`px-3 py-1 rounded-full ${config.color} text-white text-xs font-bold shadow-md`}
         
        >
          {config.label}
        </div>
      </div>

      <div
        className="pt-4 p-4 rounded-lg bg-background border border-border hover:border-border transition-colors"
       
      >
        {/* Header */}
        <div
          className="flex items-center justify-between mb-3"
         
        >
          <div
            className="flex items-center gap-2 text-muted-foreground"
           
          >
            <Calendar className="w-4 h-4" />
            <span className="text-sm">
              {config.months}
            </span>
          </div>
          <div
            className={`text-sm font-medium ${getStatusColor()}`}
           
          >
            {percentage.toFixed(0)}% used
          </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar
          value={data.actual}
          max={data.budget}
          size="md"
          animated={isOverBudget}
         
        />

        {/* Stats */}
        <div
          className="mt-3 pt-3 border-t border-border space-y-2"
         
        >
          <div
            className="flex justify-between items-center gap-2"
           
          >
            <span className="text-xs text-muted-foreground shrink-0">
              Spent
            </span>
            <span
              className="font-medium text-xs tabular-nums text-foreground"
             
            >
              {formatCurrencyCompact(data.actual)}
            </span>
          </div>
          <div
            className="flex justify-between items-center gap-2"
           
          >
            <span className="text-xs text-muted-foreground shrink-0">
              Budget
            </span>
            <span
              className="font-medium text-xs tabular-nums text-foreground"
             
            >
              {formatCurrencyCompact(data.budget)}
            </span>
          </div>
          <div
            className="flex justify-between items-center gap-2"
           
          >
            <span className="text-xs text-muted-foreground shrink-0">
              Remaining
            </span>
            <span
              className={`font-medium text-xs tabular-nums ${getStatusColor()}`}
             
            >
              {formatCurrencyCompact(remaining)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuarterSummary({ data, className }: QuarterSummaryProps) {
  // Filter out quarters with zero budget
  const activeQuarters = data.filter((d) => d.budget > 0);

  // Calculate totals
  const totalBudget = activeQuarters.reduce((sum, d) => sum + d.budget, 0);
  const totalActual = activeQuarters.reduce((sum, d) => sum + d.actual, 0);

  // Separate fiscal quarters from TBD
  const fiscalQuarters = activeQuarters.filter((d) => d.quarter !== "TBD");
  const tbdQuarter = activeQuarters.find((d) => d.quarter === "TBD");

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-md bg-spectral/10 text-muted-foreground"
             
            >
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Budget by Quarter</CardTitle>
              <CardDescription>
                FY {new Date().getFullYear()} spending timeline
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              Total Allocated
            </p>
            <p
              className="font-bold text-lg text-foreground tabular-nums"
             
            >
              {formatCurrency(totalActual)}
              <span
                className="text-muted-foreground font-normal text-sm"
               
              >
                {" "}
                /{" "}
                {formatCurrency(totalBudget)}
              </span>
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Fiscal Quarters Grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6"
         
        >
          {fiscalQuarters.map((quarter) => (
            <QuarterCard
              key={quarter.quarter}
              data={quarter}
             
            />
          ))}
        </div>

        {/* TBD Section */}
        {tbdQuarter && (
          <div
            className="pt-4 border-t border-border"
           
          >
            <div
              className="flex items-center gap-2 mb-4 text-muted-foreground"
             
            >
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">
                Unscheduled Events
              </span>
            </div>
            <QuarterCard data={tbdQuarter} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default QuarterSummary;
