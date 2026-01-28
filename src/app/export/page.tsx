'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  ExportOptions,
  ExportPreview,
  type ExportScope,
  type ExportFormat,
  type Quarter,
} from '@/components/export';

/* ============================================
   EXPORT LEDGER PAGE
   ============================================
   Victorian-themed export page for downloading
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
  const [scope, setScope] = useState<ExportScope>('year');
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [quarter, setQuarter] = useState<Quarter>('Q1');
  const [month, setMonth] = useState<number>(1);
  const [dateStart, setDateStart] = useState<string>('2026-01-01');
  const [dateEnd, setDateEnd] = useState<string>('2026-12-31');
  const fiscalYear = 2026;

  // Preview data state
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState<string>('');

  // Build query params for API
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    params.set('fiscal_year', fiscalYear.toString());

    if (scope === 'quarter') {
      params.set('quarter', quarter);
    } else if (scope === 'month') {
      params.set('month', month.toString());
    } else if (scope === 'custom') {
      params.set('date_start', dateStart);
      params.set('date_end', dateEnd);
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
        if (!response.ok) throw new Error('Failed to fetch preview');
        const data = await response.json();
        setPreviewData(data);
      } catch (error) {
        console.error('Error fetching preview:', error);
        // Use fallback mock data if API fails
        setPreviewData({
          events: { count: 0, totalBudget: 0, totalActual: 0, totalRemaining: 0 },
          categories: { count: 0, totalBudget: 0, totalActual: 0, totalRemaining: 0 },
          expenses: { count: 0, totalAmount: 0, bySource: { manual: 0, brex: 0, pdf: 0 } },
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
    setExportStatus('idle');
    setExportMessage('');

    try {
      const queryString = buildQueryParams();
      const endpoint = format === 'csv' ? '/api/export/csv' : '/api/export/excel';

      const response = await fetch(`${endpoint}?${queryString}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = format === 'csv'
        ? `counting-house-export-${fiscalYear}.csv`
        : `counting-house-export-${fiscalYear}.xlsx`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus('success');
      setExportMessage(`Successfully exported ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setExportMessage('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-wood-dark flex items-center gap-3">
          <Download className="w-8 h-8 text-ink-gold" />
          The Ledger Dispatch
        </h1>
        <p className="mt-1 text-sepia">
          Export your ledger records for analysis or archival purposes
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Options */}
        <div className="lg:col-span-2">
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
          />
        </div>

        {/* Right Column - Preview & Export */}
        <div className="space-y-6">
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
            />
          )}

          {/* Export Button Card */}
          <Card elevated>
            <CardContent className="py-6">
              <Button
                variant="success"
                size="lg"
                className="w-full"
                onClick={handleExport}
                isLoading={isExporting}
                leftIcon={<Download className="w-5 h-5" />}
                disabled={isLoadingPreview || isExporting}
              >
                {isExporting ? 'Preparing Export...' : `Export as ${format === 'csv' ? 'CSV' : 'Excel'}`}
              </Button>

              {/* Status Messages */}
              {exportStatus === 'success' && (
                <div className="mt-4 p-3 rounded-lg bg-ink-green/10 border border-ink-green/30 flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-ink-green shrink-0" />
                  <p className="text-sm text-ink-green">{exportMessage}</p>
                </div>
              )}

              {exportStatus === 'error' && (
                <div className="mt-4 p-3 rounded-lg bg-ink-red/10 border border-ink-red/30 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-ink-red shrink-0" />
                  <p className="text-sm text-ink-red">{exportMessage}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Notes */}
          <div className="p-4 rounded-lg bg-parchment border border-wood-medium/20">
            <h4 className="font-serif font-semibold text-wood-dark text-sm mb-2">
              Export Notes
            </h4>
            <ul className="space-y-1.5 text-xs text-sepia/80">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-gold/60 shrink-0 mt-1.5" />
                CSV files contain a single sheet with all expenses
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-gold/60 shrink-0 mt-1.5" />
                Excel files include separate worksheets for events, categories, and expenses
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-gold/60 shrink-0 mt-1.5" />
                All monetary values are in USD
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer Quote */}
      <div className="text-center py-6 mt-8 border-t border-wood-medium/20">
        <p className="text-xs text-sepia/60 italic">
          &ldquo;A well-kept ledger is a merchant&apos;s finest testimony.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
