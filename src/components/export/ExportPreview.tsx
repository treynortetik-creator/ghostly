"use client";

import {
  Calendar,
  FolderOpen,
  Receipt,
  TrendingUp,
  TrendingDown,
  Minus,
  FileCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import type { ExportScope, Quarter } from "./ExportOptions";

/* ============================================
   EXPORT PREVIEW COMPONENT
   ============================================
   Shows a preview of what will be exported,
   including counts and totals.
   ============================================ */

interface ExportPreviewData {
  events: {
    count: number;
    totalBudget: number;
    totalActual: number;
    totalRemaining: number;
  };
  categories: {
    count: number;
    totalBudget: number;
    totalActual: number;
    totalRemaining: number;
  };
  expenses: {
    count: number;
    totalAmount: number;
    bySource: {
      manual: number;
      brex: number;
      pdf: number;
    };
  };
}

interface ExportPreviewProps {
  scope: ExportScope;
  quarter: Quarter;
  month: number;
  dateStart: string;
  dateEnd: string;
  fiscalYear: number;
  data: ExportPreviewData;
  isLoading?: boolean;
}

function getScopeDescription(
  scope: ExportScope,
  quarter: Quarter,
  month: number,
  dateStart: string,
  dateEnd: string,
  fiscalYear: number,
): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  switch (scope) {
    case "year":
      return `Full Fiscal Year ${fiscalYear}`;
    case "quarter":
      const quarterMonths: Record<Quarter, string> = {
        Q1: "January - March",
        Q2: "April - June",
        Q3: "July - September",
        Q4: "October - December",
      };
      return `${quarter} ${fiscalYear} (${quarterMonths[quarter]})`;
    case "month":
      return `${months[month - 1]} ${fiscalYear}`;
    case "custom":
      if (dateStart && dateEnd) {
        return `${dateStart} to ${dateEnd}`;
      }
      return "Custom date range";
    default:
      return "";
  }
}

export function ExportPreview({
  scope,
  quarter,
  month,
  dateStart,
  dateEnd,
  fiscalYear,
  data,
  isLoading = false,
}: ExportPreviewProps) {
  const grandTotalBudget =
    data.events.totalBudget + data.categories.totalBudget;
  const grandTotalActual =
    data.events.totalActual + data.categories.totalActual;
  const grandTotalRemaining = grandTotalBudget - grandTotalActual;
  const remainingPercent =
    grandTotalBudget > 0
      ? Math.round((grandTotalRemaining / grandTotalBudget) * 100)
      : 0;

  const getTrendIcon = (remaining: number, budget: number) => {
    const percent = budget > 0 ? (remaining / budget) * 100 : 0;
    if (percent > 20)
      return (
        <TrendingUp className="w-4 h-4 text-emerald-400" />
      );
    if (percent < 0)
      return (
        <TrendingDown className="w-4 h-4 text-destructive" />
      );
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <Card elevated>
        <CardContent className="py-12">
          <div
            className="flex flex-col items-center justify-center"
           
          >
            <div
              className="w-8 h-8 border-2 border-spectral border-t-spectral rounded-full animate-spin"
             
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Loading preview...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevated>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-spectral" />
              Export Preview
            </CardTitle>
            <CardDescription>
              {getScopeDescription(
                scope,
                quarter,
                month,
                dateStart,
                dateEnd,
                fiscalYear,
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Grand Totals */}
        <div
          className="p-4 rounded-lg bg-ghost-dark/5 border border-border"
         
        >
          <h4
            className="text-sm font-semibold text-foreground mb-3"
           
          >
            Grand Totals
          </h4>
          <div className="space-y-3">
            <div
              className="flex justify-between items-center"
             
            >
              <span className="text-xs text-muted-foreground/60">
                Total Budget
              </span>
              <span
                className="font-semibold text-base text-foreground"
               
              >
                {formatCurrency(grandTotalBudget)}
              </span>
            </div>
            <div
              className="flex justify-between items-center"
             
            >
              <span className="text-xs text-muted-foreground/60">
                Total Spent
              </span>
              <span
                className="font-semibold text-base text-destructive"
               
              >
                {formatCurrency(grandTotalActual)}
              </span>
            </div>
            <div
              className="flex justify-between items-center"
             
            >
              <span className="text-xs text-muted-foreground/60">
                Remaining
              </span>
              <span
                className={`font-semibold text-base ${grandTotalRemaining >= 0 ? "text-emerald-400" : "text-destructive"}`}
               
              >
                {formatCurrency(grandTotalRemaining)}{" "}
                <span className="text-xs font-normal">
                  ({remainingPercent}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Section Previews */}
        <div className="grid gap-4">
          {/* Events */}
          <div
            className="p-3 rounded-lg border border-border bg-background"
           
          >
            <div
              className="flex items-center justify-between"
             
            >
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg bg-spectral/10"
                 
                >
                  <Calendar
                    className="w-3.5 h-3.5 text-spectral"
                   
                  />
                </div>
                {getTrendIcon(
                  data.events.totalRemaining,
                  data.events.totalBudget,
                )}
              </div>
              <div className="text-right">
                <h5
                  className="font-medium text-foreground text-sm"
                 
                >
                  Events
                </h5>
                <p
                  className="text-lg font-bold text-spectral"
                 
                >
                  {data.events.count}
                </p>
              </div>
            </div>
            <div
              className="mt-2 pt-2 border-t border-border grid grid-cols-3 gap-2 text-xs"
             
            >
              <div>
                <span className="text-muted-foreground/60 block">
                  Budget
                </span>
                <span className="text-muted-foreground font-medium">
                  {formatCurrency(data.events.totalBudget)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground/60 block">
                  Spent
                </span>
                <span className="text-destructive font-medium">
                  {formatCurrency(data.events.totalActual)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground/60 block">
                  Remaining
                </span>
                <span
                  className={`font-medium ${data.events.totalRemaining >= 0 ? "text-emerald-400" : "text-destructive"}`}
                 
                >
                  {formatCurrency(data.events.totalRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div
            className="p-3 rounded-lg border border-border bg-background"
           
          >
            <div
              className="flex items-center justify-between"
             
            >
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg bg-emerald-400/10"
                 
                >
                  <FolderOpen
                    className="w-3.5 h-3.5 text-emerald-400"
                   
                  />
                </div>
                {getTrendIcon(
                  data.categories.totalRemaining,
                  data.categories.totalBudget,
                )}
              </div>
              <div className="text-right">
                <h5
                  className="font-medium text-foreground text-sm"
                 
                >
                  Categories
                </h5>
                <p
                  className="text-lg font-bold text-emerald-400"
                 
                >
                  {data.categories.count}
                </p>
              </div>
            </div>
            <div
              className="mt-2 pt-2 border-t border-border grid grid-cols-3 gap-2 text-xs"
             
            >
              <div>
                <span className="text-muted-foreground/60 block">
                  Budget
                </span>
                <span className="text-muted-foreground font-medium">
                  {formatCurrency(data.categories.totalBudget)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground/60 block">
                  Spent
                </span>
                <span className="text-destructive font-medium">
                  {formatCurrency(data.categories.totalActual)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground/60 block">
                  Remaining
                </span>
                <span
                  className={`font-medium ${data.categories.totalRemaining >= 0 ? "text-emerald-400" : "text-destructive"}`}
                 
                >
                  {formatCurrency(data.categories.totalRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div
            className="p-3 rounded-lg border border-border bg-background"
           
          >
            <div
              className="flex items-center justify-between"
             
            >
              <div className="p-1.5 rounded-lg bg-muted-foreground/10">
                <Receipt
                  className="w-3.5 h-3.5 text-muted-foreground"
                 
                />
              </div>
              <div className="text-right">
                <h5
                  className="font-medium text-foreground text-sm"
                 
                >
                  Expenses
                </h5>
                <p
                  className="text-lg font-bold text-muted-foreground"
                 
                >
                  {data.expenses.count}
                </p>
              </div>
            </div>
            <div
              className="mt-2 pt-2 border-t border-border space-y-1 text-xs"
             
            >
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">
                  Total Amount
                </span>
                <span className="text-muted-foreground font-medium">
                  {formatCurrency(data.expenses.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">
                  Manual entries
                </span>
                <span className="text-muted-foreground">
                  {data.expenses.bySource.manual}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">
                  Brex imports
                </span>
                <span className="text-muted-foreground">
                  {data.expenses.bySource.brex}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">
                  PDF uploads
                </span>
                <span className="text-muted-foreground">
                  {data.expenses.bySource.pdf}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Export Note */}
        <div
          className="p-3 rounded-lg bg-spectral/10 border border-spectral"
         
        >
          <p
            className="text-xs text-muted-foreground/60 italic text-center"
           
          >
            The exported file will contain all records shown above for the
            selected time period.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default ExportPreview;
