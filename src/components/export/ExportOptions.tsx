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
   ledger data. Ghostly theme with brass
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
    <div className="space-y-6">
      {/* Scope Selection */}
      <Card elevated>
        <CardHeader>
          <CardTitle>Export Scope</CardTitle>
          <CardDescription>
            Select the time period to include in your export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
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
                        ? "border-spectral bg-spectral/10 ring-1 ring-spectral/30"
                        : "border-border hover:border-border hover:bg-background"
                    }
                  `}
                 
                >
                  <div
                    className={`
                    p-2 rounded-lg shrink-0
                    ${isSelected ? "bg-spectral/10 text-spectral" : "bg-spectral/10 text-muted-foreground"}
                  `}
                   
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}
                       
                      >
                        {option.label}
                      </span>
                      {isSelected && (
                        <div
                          className="w-2 h-2 rounded-full bg-spectral"
                         
                        />
                      )}
                    </div>
                    <p
                      className="text-xs text-muted-foreground/60 mt-0.5"
                     
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
              className="mt-6 pt-6 border-t border-border"
             
            >
              <label
                className="block text-sm font-medium text-muted-foreground mb-3"
               
              >
                Select Quarter
              </label>
              <div className="grid grid-cols-4 gap-2">
                {quarters.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => onQuarterChange(q.value)}
                    className={`
                      px-4 py-3 rounded-md border-2 text-center transition-all
                      ${
                        quarter === q.value
                          ? "border-spectral bg-spectral/10 text-foreground"
                          : "border-border hover:border-border text-muted-foreground"
                      }
                    `}
                   
                  >
                    <span
                      className="font-semibold"
                     
                    >
                      {q.label}
                    </span>
                    <p
                      className="text-[10px] text-muted-foreground/60 mt-0.5"
                     
                    >
                      {q.months}
                    </p>
                  </button>
                ))}
              </div>
              <p
                className="text-xs text-muted-foreground/60 mt-2 italic"
               
              >
                Fiscal Year {fiscalYear}: {quarter} (
                {quarters.find((q) => q.value === quarter)?.months})
              </p>
            </div>
          )}

          {scope === "month" && (
            <div
              className="mt-6 pt-6 border-t border-border"
             
            >
              <label
                className="block text-sm font-medium text-muted-foreground mb-3"
               
              >
                Select Month
              </label>
              <select
                value={month}
                onChange={(e) => onMonthChange(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-md border-2 border-border
                  bg-background text-foreground font-medium
                  focus:border-spectral focus:ring-2 focus:ring-spectral/20 focus:outline-none
                  transition-all"
               
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} {fiscalYear}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "custom" && (
            <div
              className="mt-6 pt-6 border-t border-border"
             
            >
              <label
                className="block text-sm font-medium text-muted-foreground mb-3"
               
              >
                Custom Date Range
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    className="block text-xs text-muted-foreground/60 mb-1"
                   
                  >
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => onDateStartChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-md border-2 border-border
                      bg-background text-foreground
                      focus:border-spectral focus:ring-2 focus:ring-spectral/20 focus:outline-none
                      transition-all"
                   
                  />
                </div>
                <div>
                  <label
                    className="block text-xs text-muted-foreground/60 mb-1"
                   
                  >
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => onDateEndChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-md border-2 border-border
                      bg-background text-foreground
                      focus:border-spectral focus:ring-2 focus:ring-spectral/20 focus:outline-none
                      transition-all"
                   
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Format Selection */}
      <Card elevated>
        <CardHeader>
          <CardTitle>Export Format</CardTitle>
          <CardDescription>
            Choose the file format for your export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
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
                        ? "border-emerald-400 bg-emerald-400/10 ring-1 ring-emerald-400/30"
                        : "border-border hover:border-border hover:bg-background"
                    }
                  `}
                 
                >
                  <div
                    className={`
                    p-2 rounded-lg shrink-0
                    ${isSelected ? "bg-emerald-400/10 text-emerald-400" : "bg-spectral/10 text-muted-foreground"}
                  `}
                   
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}
                       
                      >
                        {option.label}
                      </span>
                      {isSelected && (
                        <div
                          className="w-2 h-2 rounded-full bg-emerald-400"
                         
                        />
                      )}
                    </div>
                    <p
                      className="text-xs text-muted-foreground/60 mt-0.5"
                     
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
            className="mt-4 p-4 rounded-lg bg-background border border-border"
           
          >
            {format === "csv" ? (
              <div className="flex items-start gap-3">
                <FileText
                  className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5"
                 
                />
                <div>
                  <p className="text-sm text-muted-foreground">
                    A single CSV file with all expense records. Compatible with
                    Excel, Google Sheets, and other spreadsheet applications.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <FileSpreadsheet
                  className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5"
                 
                />
                <div>
                  <p className="text-sm text-muted-foreground">
                    An Excel workbook with multiple worksheets:
                  </p>
                  <ul
                    className="mt-2 space-y-1 text-xs text-muted-foreground/60"
                   
                  >
                    <li className="flex items-center gap-2">
                      <span
                        className="w-1 h-1 rounded-full bg-spectral"
                       
                      />
                      <span>
                        <strong>Summary</strong> - Grand
                        totals and overview
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="w-1 h-1 rounded-full bg-spectral"
                       
                      />
                      <span>
                        <strong>Events</strong> - Event
                        budgets and actuals
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="w-1 h-1 rounded-full bg-spectral"
                       
                      />
                      <span>
                        <strong>Categories</strong> -
                        Category budgets and actuals
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        className="w-1 h-1 rounded-full bg-spectral"
                       
                      />
                      <span>
                        <strong>Expenses</strong> - Detailed
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
