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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
        <TrendingUp className="w-4 h-4 text-ink-green" data-oid="q6xw3s-" />
      );
    if (percent < 0)
      return (
        <TrendingDown className="w-4 h-4 text-ink-red" data-oid="mcah0vh" />
      );
    return <Minus className="w-4 h-4 text-sepia" data-oid="8qjjrb9" />;
  };

  if (isLoading) {
    return (
      <Card elevated data-oid="2-kkjoh">
        <CardContent className="py-12" data-oid="yivziv0">
          <div
            className="flex flex-col items-center justify-center"
            data-oid=".uhixoo"
          >
            <div
              className="w-8 h-8 border-2 border-ink-gold/30 border-t-ink-gold rounded-full animate-spin"
              data-oid="mx1e:h8"
            />
            <p className="mt-4 text-sm text-sepia" data-oid="7c3xii2">
              Loading preview...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevated data-oid="v2oj1jz">
      <CardHeader data-oid="pc2gw9s">
        <div className="flex items-center justify-between" data-oid="aj_1u47">
          <div data-oid="5ymjsgp">
            <CardTitle className="flex items-center gap-2" data-oid="xcwk0pn">
              <FileCheck className="w-5 h-5 text-ink-gold" data-oid="wldmtk3" />
              Export Preview
            </CardTitle>
            <CardDescription data-oid="6tvb87f">
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

      <CardContent className="space-y-6" data-oid="ppctaat">
        {/* Grand Totals */}
        <div
          className="p-4 rounded-lg bg-wood-dark/5 border border-wood-medium/30"
          data-oid="zr:quix"
        >
          <h4
            className="text-sm font-serif font-semibold text-wood-dark mb-3"
            data-oid="fujrzj3"
          >
            Grand Totals
          </h4>
          <div className="space-y-3" data-oid="tztwln0">
            <div
              className="flex justify-between items-center"
              data-oid="dpiwmyk"
            >
              <span className="text-xs text-sepia/70" data-oid="7j3mp.g">
                Total Budget
              </span>
              <span
                className="font-serif font-semibold text-base text-wood-dark"
                data-oid="ucu1bji"
              >
                {formatCurrency(grandTotalBudget)}
              </span>
            </div>
            <div
              className="flex justify-between items-center"
              data-oid="k_e3vx."
            >
              <span className="text-xs text-sepia/70" data-oid="2zdddpv">
                Total Spent
              </span>
              <span
                className="font-serif font-semibold text-base text-ink-red"
                data-oid="bibql73"
              >
                {formatCurrency(grandTotalActual)}
              </span>
            </div>
            <div
              className="flex justify-between items-center"
              data-oid="prsibq0"
            >
              <span className="text-xs text-sepia/70" data-oid=":-5:c0b">
                Remaining
              </span>
              <span
                className={`font-serif font-semibold text-base ${grandTotalRemaining >= 0 ? "text-ink-green" : "text-ink-red"}`}
                data-oid="p_.gfhu"
              >
                {formatCurrency(grandTotalRemaining)}{" "}
                <span className="text-xs font-normal" data-oid="q-sdzhz">
                  ({remainingPercent}%)
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Section Previews */}
        <div className="grid gap-4" data-oid="g1-wyk:">
          {/* Events */}
          <div
            className="p-3 rounded-lg border border-wood-medium/20 bg-parchment"
            data-oid="rkhpl6a"
          >
            <div
              className="flex items-center justify-between"
              data-oid="jwxlo6w"
            >
              <div className="flex items-center gap-2" data-oid="cn4p.5h">
                <div
                  className="p-1.5 rounded-lg bg-ink-gold/10"
                  data-oid="i8x:ekp"
                >
                  <Calendar
                    className="w-3.5 h-3.5 text-ink-gold"
                    data-oid="zo2j-ut"
                  />
                </div>
                {getTrendIcon(
                  data.events.totalRemaining,
                  data.events.totalBudget,
                )}
              </div>
              <div className="text-right" data-oid="gkv6xp5">
                <h5
                  className="font-medium text-wood-dark text-sm"
                  data-oid="kobdxab"
                >
                  Events
                </h5>
                <p
                  className="text-lg font-serif font-bold text-ink-gold"
                  data-oid="998:7xi"
                >
                  {data.events.count}
                </p>
              </div>
            </div>
            <div
              className="mt-2 pt-2 border-t border-wood-medium/20 grid grid-cols-3 gap-2 text-xs"
              data-oid="98kb8vu"
            >
              <div data-oid="phg3p.d">
                <span className="text-sepia/70 block" data-oid="ww.ja8:">
                  Budget
                </span>
                <span className="text-sepia font-medium" data-oid="ltcliac">
                  {formatCurrency(data.events.totalBudget)}
                </span>
              </div>
              <div data-oid="2c0fpzn">
                <span className="text-sepia/70 block" data-oid="i6nxcn5">
                  Spent
                </span>
                <span className="text-ink-red font-medium" data-oid="m:_dme6">
                  {formatCurrency(data.events.totalActual)}
                </span>
              </div>
              <div data-oid="7-4fyz9">
                <span className="text-sepia/70 block" data-oid="-3so18m">
                  Remaining
                </span>
                <span
                  className={`font-medium ${data.events.totalRemaining >= 0 ? "text-ink-green" : "text-ink-red"}`}
                  data-oid="af6cuff"
                >
                  {formatCurrency(data.events.totalRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div
            className="p-3 rounded-lg border border-wood-medium/20 bg-parchment"
            data-oid="p1wtlwp"
          >
            <div
              className="flex items-center justify-between"
              data-oid="4ryo.9e"
            >
              <div className="flex items-center gap-2" data-oid="n210g:j">
                <div
                  className="p-1.5 rounded-lg bg-ink-green/10"
                  data-oid="29h0pil"
                >
                  <FolderOpen
                    className="w-3.5 h-3.5 text-ink-green"
                    data-oid="9kvwv_h"
                  />
                </div>
                {getTrendIcon(
                  data.categories.totalRemaining,
                  data.categories.totalBudget,
                )}
              </div>
              <div className="text-right" data-oid="lb49rs_">
                <h5
                  className="font-medium text-wood-dark text-sm"
                  data-oid="gdcehl9"
                >
                  Categories
                </h5>
                <p
                  className="text-lg font-serif font-bold text-ink-green"
                  data-oid="j01gfkq"
                >
                  {data.categories.count}
                </p>
              </div>
            </div>
            <div
              className="mt-2 pt-2 border-t border-wood-medium/20 grid grid-cols-3 gap-2 text-xs"
              data-oid="t44q-wj"
            >
              <div data-oid="tk:q8ss">
                <span className="text-sepia/70 block" data-oid="pxsmugx">
                  Budget
                </span>
                <span className="text-sepia font-medium" data-oid="ashu_m4">
                  {formatCurrency(data.categories.totalBudget)}
                </span>
              </div>
              <div data-oid="vr7.f9b">
                <span className="text-sepia/70 block" data-oid="qtbl_sp">
                  Spent
                </span>
                <span className="text-ink-red font-medium" data-oid="6f4eg5c">
                  {formatCurrency(data.categories.totalActual)}
                </span>
              </div>
              <div data-oid="d_wl.4k">
                <span className="text-sepia/70 block" data-oid="skald2w">
                  Remaining
                </span>
                <span
                  className={`font-medium ${data.categories.totalRemaining >= 0 ? "text-ink-green" : "text-ink-red"}`}
                  data-oid="ewlls6w"
                >
                  {formatCurrency(data.categories.totalRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div
            className="p-3 rounded-lg border border-wood-medium/20 bg-parchment"
            data-oid="i2876ej"
          >
            <div
              className="flex items-center justify-between"
              data-oid="d0hrae8"
            >
              <div className="p-1.5 rounded-lg bg-sepia/10" data-oid="l5s-jhm">
                <Receipt
                  className="w-3.5 h-3.5 text-sepia"
                  data-oid="dba1bgq"
                />
              </div>
              <div className="text-right" data-oid="8rgfq00">
                <h5
                  className="font-medium text-wood-dark text-sm"
                  data-oid="7n.li8-"
                >
                  Expenses
                </h5>
                <p
                  className="text-lg font-serif font-bold text-sepia"
                  data-oid="oa6k3-q"
                >
                  {data.expenses.count}
                </p>
              </div>
            </div>
            <div
              className="mt-2 pt-2 border-t border-wood-medium/20 space-y-1 text-xs"
              data-oid="awdc.ke"
            >
              <div className="flex justify-between" data-oid="1is4nzj">
                <span className="text-sepia/70" data-oid="3p122rr">
                  Total Amount
                </span>
                <span className="text-sepia font-medium" data-oid="8n7rugb">
                  {formatCurrency(data.expenses.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between" data-oid="qyjvugh">
                <span className="text-sepia/70" data-oid="6zl079w">
                  Manual entries
                </span>
                <span className="text-sepia" data-oid="1ub_sv6">
                  {data.expenses.bySource.manual}
                </span>
              </div>
              <div className="flex justify-between" data-oid="m_ro3_9">
                <span className="text-sepia/70" data-oid="2.__1ga">
                  Brex imports
                </span>
                <span className="text-sepia" data-oid="udijcba">
                  {data.expenses.bySource.brex}
                </span>
              </div>
              <div className="flex justify-between" data-oid="2kmr-9l">
                <span className="text-sepia/70" data-oid="r5i_o:v">
                  PDF uploads
                </span>
                <span className="text-sepia" data-oid="j_lfafp">
                  {data.expenses.bySource.pdf}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Export Note */}
        <div
          className="p-3 rounded-lg bg-ink-gold/5 border border-ink-gold/20"
          data-oid="a7n_3vz"
        >
          <p
            className="text-xs text-sepia/80 italic text-center"
            data-oid="71oaxtm"
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
