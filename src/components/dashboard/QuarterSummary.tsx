"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  ProgressBar,
} from "@/components/ui";
import { Calendar, Clock } from "lucide-react";
import type { QuarterType } from "@/types/database";

/* ============================================
   QUARTER SUMMARY
   ============================================
   Displays budget breakdown by quarter with
   Victorian-styled timeline and progress bars.
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
    color: "bg-ink-green",
  },
  Q2: {
    label: "Q2",
    months: "Apr - Jun",
    color: "bg-ink-gold",
  },
  Q3: {
    label: "Q3",
    months: "Jul - Sep",
    color: "bg-wood-medium",
  },
  Q4: {
    label: "Q4",
    months: "Oct - Dec",
    color: "bg-ink-red",
  },
  TBD: {
    label: "TBD",
    months: "Unscheduled",
    color: "bg-sepia",
  },
};

function QuarterCard({ data }: { data: QuarterData }) {
  const config = quarterConfig[data.quarter];
  const percentage = data.budget > 0 ? (data.actual / data.budget) * 100 : 0;
  const remaining = data.budget - data.actual;
  const isOverBudget = data.actual > data.budget;

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
    if (percentage >= 80) return "text-ink-gold";
    return "text-ink-green";
  };

  // Skip quarters with no budget
  if (data.budget === 0) {
    return null;
  }

  return (
    <div className="relative" data-oid="6vy9r1b">
      {/* Quarter Badge */}
      <div className="absolute -top-3 left-4 z-10" data-oid="tkkz.:u">
        <div
          className={`px-3 py-1 rounded-full ${config.color} text-white text-xs font-bold shadow-md`}
          data-oid="s3_wurk"
        >
          {config.label}
        </div>
      </div>

      <div
        className="pt-4 p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
        data-oid="dp58oog"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between mb-3"
          data-oid="1gkexno"
        >
          <div
            className="flex items-center gap-2 text-sepia"
            data-oid="m4bi:wd"
          >
            <Calendar className="w-4 h-4" data-oid="88pj.vh" />
            <span className="text-sm" data-oid="99bp4rf">
              {config.months}
            </span>
          </div>
          <div
            className={`text-sm font-medium ${getStatusColor()}`}
            data-oid="erosism"
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
          data-oid="3l-9ih-"
        />

        {/* Stats */}
        <div
          className="mt-3 pt-3 border-t border-wood-medium/15 space-y-2 overflow-hidden"
          data-oid="r2v2cfn"
        >
          <div
            className="flex justify-between items-center gap-2"
            data-oid="f9z:zjp"
          >
            <span className="text-xs text-sepia shrink-0" data-oid="apsg3fz">
              Spent
            </span>
            <span
              className="font-medium text-xs tabular-nums text-ink-black truncate"
              data-oid="t9hhtd6"
            >
              {formatCurrency(data.actual)}
            </span>
          </div>
          <div
            className="flex justify-between items-center gap-2"
            data-oid="gk0lms-"
          >
            <span className="text-xs text-sepia shrink-0" data-oid="ocgcled">
              Budget
            </span>
            <span
              className="font-medium text-xs tabular-nums text-ink-black truncate"
              data-oid="4_5c_g4"
            >
              {formatCurrency(data.budget)}
            </span>
          </div>
          <div
            className="flex justify-between items-center gap-2"
            data-oid="ybu9qq7"
          >
            <span className="text-xs text-sepia shrink-0" data-oid="v20iz0q">
              Remaining
            </span>
            <span
              className={`font-medium text-xs tabular-nums truncate ${getStatusColor()}`}
              data-oid="y8sfdov"
            >
              {formatCurrency(remaining)}
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
    <Card className={className} data-oid="g.hqo70">
      <CardHeader data-oid="rgdyf:n">
        <div className="flex items-center justify-between" data-oid="8kf53p8">
          <div className="flex items-center gap-3" data-oid="6oxjxlf">
            <div
              className="p-2 rounded-md bg-wood-medium/10 text-wood-medium"
              data-oid="h5_2jrp"
            >
              <Clock className="w-5 h-5" data-oid=".em-a7q" />
            </div>
            <div data-oid="joysop4">
              <CardTitle data-oid="3vo2k2s">Budget by Quarter</CardTitle>
              <CardDescription data-oid="e.:ekbn">
                FY 2026 spending timeline
              </CardDescription>
            </div>
          </div>
          <div className="text-right" data-oid="li60weh">
            <p className="text-sm text-sepia" data-oid="1qnqh.y">
              Total Allocated
            </p>
            <p
              className="font-serif font-bold text-lg text-ink-black tabular-nums"
              data-oid="7pohq5a"
            >
              {totalActual.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <span
                className="text-sepia font-normal text-sm"
                data-oid=".mk1qgp"
              >
                {" "}
                /{" "}
                {totalBudget.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent data-oid="i_vbdws">
        {/* Fiscal Quarters Grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6"
          data-oid="gnuc4a2"
        >
          {fiscalQuarters.map((quarter) => (
            <QuarterCard
              key={quarter.quarter}
              data={quarter}
              data-oid="l-8ajam"
            />
          ))}
        </div>

        {/* TBD Section */}
        {tbdQuarter && (
          <div
            className="pt-4 border-t border-wood-medium/20"
            data-oid="y-zzesp"
          >
            <div
              className="flex items-center gap-2 mb-4 text-sepia"
              data-oid="f8f6g48"
            >
              <Clock className="w-4 h-4" data-oid="eui9h9t" />
              <span className="text-sm font-medium" data-oid="tqozxgk">
                Unscheduled Events
              </span>
            </div>
            <QuarterCard data={tbdQuarter} data-oid="6bloz7g" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default QuarterSummary;
