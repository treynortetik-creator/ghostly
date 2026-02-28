"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, AlertCircle, CheckCircle } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  ExportOptions,
  ExportPreview,
  type ExportScope,
  type ExportFormat,
  type Quarter,
} from "@/components/export";

/* ============================================
   EXPORT LEDGER PAGE
   ============================================
   Ghostly-themed export page for downloading
   budget data in CSV or Excel format.
   Theme: "The Ledger Dispatch"
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

export default function ExportPage() {
  // Export options state
  const [scope, setScope] = useState<ExportScope>("year");
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [quarter, setQuarter] = useState<Quarter>("Q1");
  const [month, setMonth] = useState<number>(1);
  const [dateStart, setDateStart] = useState<string>("2026-01-01");
  const [dateEnd, setDateEnd] = useState<string>("2026-12-31");
  const fiscalYear = 2026;

  // Preview data state
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(
    null,
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [exportMessage, setExportMessage] = useState<string>("");

  // Build query params for API
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("scope", scope);
    params.set("fiscal_year", fiscalYear.toString());

    if (scope === "quarter") {
      params.set("quarter", quarter);
    } else if (scope === "month") {
      params.set("month", month.toString());
    } else if (scope === "custom") {
      params.set("date_start", dateStart);
      params.set("date_end", dateEnd);
    }

    return params.toString();
  }, [scope, quarter, month, dateStart, dateEnd, fiscalYear]);

  // Fetch preview data when options change
  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      try {
        const queryString = buildQueryParams();
        const response = await fetch(`/api/export/preview?${queryString}`);
        if (!response.ok) throw new Error("Failed to fetch preview");
        const data = await response.json();
        setPreviewData(data);
      } catch (error) {
        console.error("Error fetching preview:", error);
        // Use fallback mock data if API fails
        setPreviewData({
          events: {
            count: 0,
            totalBudget: 0,
            totalActual: 0,
            totalRemaining: 0,
          },
          categories: {
            count: 0,
            totalBudget: 0,
            totalActual: 0,
            totalRemaining: 0,
          },
          expenses: {
            count: 0,
            totalAmount: 0,
            bySource: { manual: 0, brex: 0, pdf: 0 },
          },
        });
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchPreview();
  }, [buildQueryParams]);

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus("idle");
    setExportMessage("");

    try {
      const queryString = buildQueryParams();
      const endpoint =
        format === "csv" ? "/api/export/csv" : "/api/export/excel";

      const response = await fetch(`${endpoint}?${queryString}`);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename =
        format === "csv"
          ? `ghostly-export-${fiscalYear}.csv`
          : `ghostly-export-${fiscalYear}.xlsx`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus("success");
      setExportMessage(`Successfully exported ${filename}`);
    } catch (error) {
      console.error("Export error:", error);
      setExportStatus("error");
      setExportMessage("Failed to export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell data-oid="6l.yoh-">
      {/* Page Header */}
      <div className="mb-8" data-oid="rupzpjv">
        <h1
          className="text-3xl font-bold text-foreground flex items-center gap-3"
          data-oid="tkto6sa"
        >
          <Download className="w-8 h-8 text-spectral" data-oid="qpbtrwz" />
          The Ledger Dispatch
        </h1>
        <p className="mt-1 text-muted-foreground" data-oid="msevj49">
          Export your ledger records for analysis or archival purposes
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3" data-oid="57c91w0">
        {/* Left Column - Options */}
        <div className="lg:col-span-2" data-oid="omwkrbx">
          <ExportOptions
            scope={scope}
            onScopeChange={setScope}
            format={format}
            onFormatChange={setFormat}
            quarter={quarter}
            onQuarterChange={setQuarter}
            month={month}
            onMonthChange={setMonth}
            dateStart={dateStart}
            onDateStartChange={setDateStart}
            dateEnd={dateEnd}
            onDateEndChange={setDateEnd}
            fiscalYear={fiscalYear}
            data-oid="qc-1wf_"
          />
        </div>

        {/* Right Column - Preview & Export */}
        <div className="space-y-6" data-oid="zli_m_v">
          {previewData && (
            <ExportPreview
              scope={scope}
              quarter={quarter}
              month={month}
              dateStart={dateStart}
              dateEnd={dateEnd}
              fiscalYear={fiscalYear}
              data={previewData}
              isLoading={isLoadingPreview}
              data-oid="_39k94v"
            />
          )}

          {/* Export Button Card */}
          <Card elevated data-oid="5.:fbn7">
            <CardContent className="py-6" data-oid="ce6n04_">
              <Button
                variant="success"
                size="lg"
                className="w-full"
                onClick={handleExport}
                isLoading={isExporting}
                leftIcon={<Download className="w-5 h-5" data-oid="5jwex22" />}
                disabled={isLoadingPreview || isExporting}
                data-oid="badlgak"
              >
                {isExporting
                  ? "Preparing Export..."
                  : `Export as ${format === "csv" ? "CSV" : "Excel"}`}
              </Button>

              {/* Status Messages */}
              {exportStatus === "success" && (
                <div
                  className="mt-4 p-3 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-start gap-2"
                  data-oid="_mf4did"
                >
                  <CheckCircle
                    className="w-5 h-5 text-emerald-400 shrink-0"
                    data-oid="fcbrc1u"
                  />
                  <p className="text-sm text-emerald-400" data-oid="a24b3pl">
                    {exportMessage}
                  </p>
                </div>
              )}

              {exportStatus === "error" && (
                <div
                  className="mt-4 p-3 rounded-lg bg-red-400/10 border border-destructive/30 flex items-start gap-2"
                  data-oid="5_-2ks1"
                >
                  <AlertCircle
                    className="w-5 h-5 text-destructive shrink-0"
                    data-oid="o8067-v"
                  />
                  <p className="text-sm text-destructive" data-oid="n4mr1tq">
                    {exportMessage}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Notes */}
          <div
            className="p-4 rounded-lg bg-background border border-border"
            data-oid="hu.ggzd"
          >
            <h4
              className="font-semibold text-foreground text-sm mb-2"
              data-oid="6-.d6wf"
            >
              Export Notes
            </h4>
            <ul
              className="space-y-1.5 text-xs text-muted-foreground/60"
              data-oid="q5cvcpb"
            >
              <li className="flex items-start gap-2" data-oid="69hmpv3">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-spectral/10 shrink-0 mt-1.5"
                  data-oid=".6us0ri"
                />
                CSV files contain a single sheet with all expenses
              </li>
              <li className="flex items-start gap-2" data-oid="6j8wtzs">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-spectral/10 shrink-0 mt-1.5"
                  data-oid="x_evx.n"
                />
                Excel files include separate worksheets for events, categories,
                and expenses
              </li>
              <li className="flex items-start gap-2" data-oid="gki-ihx">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-spectral/10 shrink-0 mt-1.5"
                  data-oid=".75slj2"
                />
                All monetary values are in USD
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer Quote */}
      <div
        className="text-center py-6 mt-8 border-t border-border"
        data-oid="fz8jf05"
      >
        <p className="text-xs text-muted-foreground/60 italic" data-oid="h1ey9n7">
          &ldquo;A well-kept ledger is a merchant&apos;s finest
          testimony.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
