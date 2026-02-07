"use client";

import {
  Calendar,
  CalendarRange,
  CalendarDays,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";

/* ============================================
   EXPORT OPTIONS COMPONENT
   ============================================
   Scope and format selection for exporting
   ledger data. Victorian theme with brass
   radio-style selection controls.
   ============================================ */

export type ExportScope = "year" | "quarter" | "month" | "custom";
export type ExportFormat = "csv" | "excel";
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

interface ExportOptionsProps {
  scope: ExportScope;
  onScopeChange: (scope: ExportScope) => void;
  format: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  quarter: Quarter;
  onQuarterChange: (quarter: Quarter) => void;
  month: number;
  onMonthChange: (month: number) => void;
  dateStart: string;
  onDateStartChange: (date: string) => void;
  dateEnd: string;
  onDateEndChange: (date: string) => void;
  fiscalYear: number;
}

const scopeOptions: {
  value: ExportScope;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "year",
    label: "Entire Fiscal Year",
    description: "Export all records for the fiscal year",
    icon: Calendar,
  },
  {
    value: "quarter",
    label: "Specific Quarter",
    description: "Export records from a single quarter",
    icon: CalendarRange,
  },
  {
    value: "month",
    label: "Specific Month",
    description: "Export records from a single month",
    icon: CalendarDays,
  },
  {
    value: "custom",
    label: "Custom Date Range",
    description: "Define a custom date range",
    icon: CalendarRange,
  },
];

const formatOptions: {
  value: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "csv",
    label: "CSV File",
    description: "Comma-separated values, universal compatibility",
    icon: FileText,
  },
  {
    value: "excel",
    label: "Excel Workbook",
    description: "Multiple worksheets with formatting",
    icon: FileSpreadsheet,
  },
];

const quarters: { value: Quarter; label: string; months: string }[] = [
  { value: "Q1", label: "Q1", months: "January - March" },
  { value: "Q2", label: "Q2", months: "April - June" },
  { value: "Q3", label: "Q3", months: "July - September" },
  { value: "Q4", label: "Q4", months: "October - December" },
];

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export function ExportOptions({
  scope,
  onScopeChange,
  format,
  onFormatChange,
  quarter,
  onQuarterChange,
  month,
  onMonthChange,
  dateStart,
  onDateStartChange,
  dateEnd,
  onDateEndChange,
  fiscalYear,
}: ExportOptionsProps) {
  return (
    <div className="space-y-6" data-oid="nw0f02u">
      {/* Scope Selection */}
      <Card elevated data-oid="ep9pbk6">
        <CardHeader data-oid="2mwtadm">
          <CardTitle data-oid=":ftsfuq">Export Scope</CardTitle>
          <CardDescription data-oid="di-lo7k">
            Select the time period to include in your export
          </CardDescription>
        </CardHeader>
        <CardContent data-oid="0xmxu9j">
          <div className="grid gap-3 sm:grid-cols-2" data-oid="h4n1r0j">
            {scopeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = scope === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => onScopeChange(option.value)}
                  className={`
                    flex items-start gap-3 p-4 rounded-lg border-2 text-left
                    transition-all duration-200
                    ${
                      isSelected
                        ? "border-ink-gold bg-ink-gold/5 ring-1 ring-ink-gold/30"
                        : "border-wood-medium/30 hover:border-wood-medium/50 hover:bg-parchment"
                    }
                  `}
                  data-oid=":h3ztvd"
                >
                  <div
                    className={`
                    p-2 rounded-lg shrink-0
                    ${isSelected ? "bg-ink-gold/15 text-ink-gold" : "bg-wood-medium/10 text-wood-medium"}
                  `}
                    data-oid="vadn-do"
                  >
                    <Icon className="w-5 h-5" data-oid="x-mduj6" />
                  </div>
                  <div className="flex-1 min-w-0" data-oid="-kfncyv">
                    <div className="flex items-center gap-2" data-oid="_s.x9su">
                      <span
                        className={`font-medium ${isSelected ? "text-wood-dark" : "text-sepia"}`}
                        data-oid="s44f3-z"
                      >
                        {option.label}
                      </span>
                      {isSelected && (
                        <div
                          className="w-2 h-2 rounded-full bg-ink-gold"
                          data-oid="e4g9fin"
                        />
                      )}
                    </div>
                    <p
                      className="text-xs text-sepia/70 mt-0.5"
                      data-oid="ou-5c:9"
                    >
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Additional Options Based on Scope */}
          {scope === "quarter" && (
            <div
              className="mt-6 pt-6 border-t border-wood-medium/20"
              data-oid="7hmoi:i"
            >
              <label
                className="block text-sm font-medium text-sepia mb-3"
                data-oid="5socxgj"
              >
                Select Quarter
              </label>
              <div className="grid grid-cols-4 gap-2" data-oid="mgbjpxb">
                {quarters.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => onQuarterChange(q.value)}
                    className={`
                      px-4 py-3 rounded-md border-2 text-center transition-all
                      ${
                        quarter === q.value
                          ? "border-ink-gold bg-ink-gold/10 text-wood-dark"
                          : "border-wood-medium/30 hover:border-wood-medium/50 text-sepia"
                      }
                    `}
                    data-oid="ndysrpv"
                  >
                    <span
                      className="font-serif font-semibold"
                      data-oid=".4qrews"
                    >
                      {q.label}
                    </span>
                    <p
                      className="text-[10px] text-sepia/70 mt-0.5"
                      data-oid="47ek1f."
                    >
                      {q.months}
                    </p>
                  </button>
                ))}
              </div>
              <p
                className="text-xs text-sepia/60 mt-2 italic"
                data-oid="rlmjwk3"
              >
                Fiscal Year {fiscalYear}: {quarter} (
                {quarters.find((q) => q.value === quarter)?.months})
              </p>
            </div>
          )}

          {scope === "month" && (
            <div
              className="mt-6 pt-6 border-t border-wood-medium/20"
              data-oid="8.1_aew"
            >
              <label
                className="block text-sm font-medium text-sepia mb-3"
                data-oid="2_g2ba."
              >
                Select Month
              </label>
              <select
                value={month}
                onChange={(e) => onMonthChange(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-md border-2 border-wood-medium/30
                  bg-parchment text-wood-dark font-medium
                  focus:border-ink-gold focus:ring-2 focus:ring-ink-gold/20 focus:outline-none
                  transition-all"
                data-oid="lvtrvnu"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value} data-oid="lfmq2le">
                    {m.label} {fiscalYear}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "custom" && (
            <div
              className="mt-6 pt-6 border-t border-wood-medium/20"
              data-oid="e97nh53"
            >
              <label
                className="block text-sm font-medium text-sepia mb-3"
                data-oid="wx03haf"
              >
                Custom Date Range
              </label>
              <div className="grid gap-4 sm:grid-cols-2" data-oid="-1.8:3l">
                <div data-oid="ydfou57">
                  <label
                    className="block text-xs text-sepia/70 mb-1"
                    data-oid="1nogicg"
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => onDateStartChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-md border-2 border-wood-medium/30
                      bg-parchment text-wood-dark
                      focus:border-ink-gold focus:ring-2 focus:ring-ink-gold/20 focus:outline-none
                      transition-all"
                    data-oid="zhf5ar9"
                  />
                </div>
                <div data-oid="_276zsk">
                  <label
                    className="block text-xs text-sepia/70 mb-1"
                    data-oid="01fk9jb"
                  >
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => onDateEndChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-md border-2 border-wood-medium/30
                      bg-parchment text-wood-dark
                      focus:border-ink-gold focus:ring-2 focus:ring-ink-gold/20 focus:outline-none
                      transition-all"
                    data-oid="4bo.b-5"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Format Selection */}
      <Card elevated data-oid="z52lrf5">
        <CardHeader data-oid="8cgk2c6">
          <CardTitle data-oid="054tjnh">Export Format</CardTitle>
          <CardDescription data-oid="ebixe:n">
            Choose the file format for your export
          </CardDescription>
        </CardHeader>
        <CardContent data-oid=":rhxgj5">
          <div className="grid gap-3 sm:grid-cols-2" data-oid="a81ebol">
            {formatOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = format === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => onFormatChange(option.value)}
                  className={`
                    flex items-start gap-3 p-4 rounded-lg border-2 text-left
                    transition-all duration-200
                    ${
                      isSelected
                        ? "border-ink-green bg-ink-green/5 ring-1 ring-ink-green/30"
                        : "border-wood-medium/30 hover:border-wood-medium/50 hover:bg-parchment"
                    }
                  `}
                  data-oid="cxkemid"
                >
                  <div
                    className={`
                    p-2 rounded-lg shrink-0
                    ${isSelected ? "bg-ink-green/15 text-ink-green" : "bg-wood-medium/10 text-wood-medium"}
                  `}
                    data-oid="8m9gmoi"
                  >
                    <Icon className="w-5 h-5" data-oid="200oz39" />
                  </div>
                  <div className="flex-1 min-w-0" data-oid="jyaozxi">
                    <div className="flex items-center gap-2" data-oid="ysvgim-">
                      <span
                        className={`font-medium ${isSelected ? "text-wood-dark" : "text-sepia"}`}
                        data-oid="a:kvee9"
                      >
                        {option.label}
                      </span>
                      {isSelected && (
                        <div
                          className="w-2 h-2 rounded-full bg-ink-green"
                          data-oid="j_mdb_7"
                        />
                      )}
                    </div>
                    <p
                      className="text-xs text-sepia/70 mt-0.5"
                      data-oid="bzc60r_"
                    >
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Format Details */}
          <div
            className="mt-4 p-4 rounded-lg bg-parchment border border-wood-medium/20"
            data-oid="aaukb16"
          >
            {format === "csv" ? (
              <div className="flex items-start gap-3" data-oid="4ed11--">
                <FileText
                  className="w-5 h-5 text-sepia shrink-0 mt-0.5"
                  data-oid="d_it_zf"
                />
                <div data-oid="7zney2b">
                  <p className="text-sm text-sepia" data-oid="764xxl.">
                    A single CSV file with all expense records. Compatible with
                    Excel, Google Sheets, and other spreadsheet applications.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3" data-oid="nuvp1xj">
                <FileSpreadsheet
                  className="w-5 h-5 text-sepia shrink-0 mt-0.5"
                  data-oid="c4:k2iu"
                />
                <div data-oid="uo2ycyl">
                  <p className="text-sm text-sepia" data-oid="pxc8w3g">
                    An Excel workbook with multiple worksheets:
                  </p>
                  <ul
                    className="mt-2 space-y-1 text-xs text-sepia/70"
                    data-oid="nf72012"
                  >
                    <li className="flex items-center gap-2" data-oid="dwkf.p5">
                      <span
                        className="w-1 h-1 rounded-full bg-ink-gold"
                        data-oid="3j8thls"
                      />
                      <span data-oid="dfaplu-">
                        <strong data-oid="xbpph1d">Summary</strong> - Grand
                        totals and overview
                      </span>
                    </li>
                    <li className="flex items-center gap-2" data-oid="w2ugr3j">
                      <span
                        className="w-1 h-1 rounded-full bg-ink-gold"
                        data-oid="5_alae8"
                      />
                      <span data-oid="q-1zqef">
                        <strong data-oid="6r:bu.y">Events</strong> - Event
                        budgets and actuals
                      </span>
                    </li>
                    <li className="flex items-center gap-2" data-oid="gypsdug">
                      <span
                        className="w-1 h-1 rounded-full bg-ink-gold"
                        data-oid="6xzl3fb"
                      />
                      <span data-oid="c39ht6f">
                        <strong data-oid="hkndt5m">Categories</strong> -
                        Category budgets and actuals
                      </span>
                    </li>
                    <li className="flex items-center gap-2" data-oid="0a:v7.t">
                      <span
                        className="w-1 h-1 rounded-full bg-ink-gold"
                        data-oid="193ctko"
                      />
                      <span data-oid="5gsbsdz">
                        <strong data-oid="ttjy7dt">Expenses</strong> - Detailed
                        expense records
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ExportOptions;
