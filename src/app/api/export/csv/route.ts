import { NextResponse } from 'next/server';
import { getEventsWithTotals } from '@/lib/mock-data/events';
import { getCategoriesWithTotals } from '@/lib/mock-data/categories';
import { getExpenses } from '@/lib/mock-data/expenses';

/* ============================================
   CSV EXPORT API
   ============================================
   Returns a downloadable CSV file containing
   all expense records for the selected scope.
   ============================================ */

type ExportScope = 'year' | 'quarter' | 'month' | 'custom';

interface DateRange {
  start: string;
  end: string;
}

function getDateRangeForScope(
  scope: ExportScope,
  fiscalYear: number,
  quarter?: string,
  month?: number,
  dateStart?: string,
  dateEnd?: string
): DateRange {
  switch (scope) {
    case 'year':
      return {
        start: `${fiscalYear}-01-01`,
        end: `${fiscalYear}-12-31`,
      };
    case 'quarter': {
      const quarterRanges: Record<string, DateRange> = {
        Q1: { start: `${fiscalYear}-01-01`, end: `${fiscalYear}-03-31` },
        Q2: { start: `${fiscalYear}-04-01`, end: `${fiscalYear}-06-30` },
        Q3: { start: `${fiscalYear}-07-01`, end: `${fiscalYear}-09-30` },
        Q4: { start: `${fiscalYear}-10-01`, end: `${fiscalYear}-12-31` },
      };
      return quarterRanges[quarter || 'Q1'];
    }
    case 'month': {
      const m = month || 1;
      const monthStr = m.toString().padStart(2, '0');
      const lastDay = new Date(fiscalYear, m, 0).getDate();
      return {
        start: `${fiscalYear}-${monthStr}-01`,
        end: `${fiscalYear}-${monthStr}-${lastDay.toString().padStart(2, '0')}`,
      };
    }
    case 'custom':
      return {
        start: dateStart || `${fiscalYear}-01-01`,
        end: dateEnd || `${fiscalYear}-12-31`,
      };
    default:
      return {
        start: `${fiscalYear}-01-01`,
        end: `${fiscalYear}-12-31`,
      };
  }
}

function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') || 'year') as ExportScope;
    const fiscalYear = parseInt(searchParams.get('fiscal_year') || '2026', 10);
    const quarter = searchParams.get('quarter') || 'Q1';
    const month = parseInt(searchParams.get('month') || '1', 10);
    const dateStart = searchParams.get('date_start') || undefined;
    const dateEnd = searchParams.get('date_end') || undefined;

    const dateRange = getDateRangeForScope(scope, fiscalYear, quarter, month, dateStart, dateEnd);

    // Get all data
    const allEvents = getEventsWithTotals();
    const allCategories = getCategoriesWithTotals();
    const allExpenses = getExpenses({
      date_start: dateRange.start,
      date_end: dateRange.end,
    });

    // Filter events based on scope
    let filteredEvents = allEvents;
    if (scope === 'quarter') {
      filteredEvents = allEvents.filter(e => e.quarter === quarter);
    } else if (scope === 'month' || scope === 'custom') {
      filteredEvents = allEvents.filter(e => {
        if (!e.date_start) return false;
        return e.date_start >= dateRange.start && e.date_start <= dateRange.end;
      });
    }

    // Build CSV content
    const lines: string[] = [];

    // Title and metadata
    lines.push(`"The Counting House - Export Report"`);
    lines.push(`"Fiscal Year ${fiscalYear}"`);
    lines.push(`"Export Date: ${new Date().toISOString().split('T')[0]}"`);
    lines.push(`"Scope: ${scope === 'year' ? 'Full Year' : scope === 'quarter' ? quarter : scope === 'month' ? `Month ${month}` : `${dateStart} to ${dateEnd}`}"`);
    lines.push('');

    // Section: Events Summary
    lines.push('"=== EVENTS SUMMARY ==="');
    lines.push('"Event Name","Event Type","Quarter","Budget","Actual Spent","Remaining","Location"');
    for (const event of filteredEvents) {
      lines.push([
        escapeCSVValue(event.name),
        escapeCSVValue(event.event_type),
        escapeCSVValue(event.quarter),
        formatCurrency(event.budget_amount),
        formatCurrency(event.actual_spent),
        formatCurrency(event.remaining),
        escapeCSVValue(event.location),
      ].join(','));
    }
    lines.push('');

    // Events totals row
    const eventsTotalBudget = filteredEvents.reduce((sum, e) => sum + e.budget_amount, 0);
    const eventsTotalActual = filteredEvents.reduce((sum, e) => sum + e.actual_spent, 0);
    const eventsTotalRemaining = filteredEvents.reduce((sum, e) => sum + e.remaining, 0);
    lines.push(`"EVENTS TOTAL","","",${formatCurrency(eventsTotalBudget)},${formatCurrency(eventsTotalActual)},${formatCurrency(eventsTotalRemaining)},""`);
    lines.push('');

    // Section: Categories Summary
    lines.push('"=== CATEGORIES SUMMARY ==="');
    lines.push('"Category Name","Description","Budget","Actual Spent","Remaining"');
    for (const category of allCategories) {
      lines.push([
        escapeCSVValue(category.name),
        escapeCSVValue(category.description),
        formatCurrency(category.budget_amount),
        formatCurrency(category.actual_spent),
        formatCurrency(category.remaining),
      ].join(','));
    }
    lines.push('');

    // Categories totals row
    const categoriesTotalBudget = allCategories.reduce((sum, c) => sum + c.budget_amount, 0);
    const categoriesTotalActual = allCategories.reduce((sum, c) => sum + c.actual_spent, 0);
    const categoriesTotalRemaining = allCategories.reduce((sum, c) => sum + c.remaining, 0);
    lines.push(`"CATEGORIES TOTAL","",${formatCurrency(categoriesTotalBudget)},${formatCurrency(categoriesTotalActual)},${formatCurrency(categoriesTotalRemaining)}`);
    lines.push('');

    // Section: Expenses Detail
    lines.push('"=== EXPENSES DETAIL ==="');
    lines.push('"Date","Vendor","Amount","Event/Category","Type","Source","Memo"');
    for (const expense of allExpenses) {
      lines.push([
        escapeCSVValue(expense.expense_date),
        escapeCSVValue(expense.vendor),
        formatCurrency(expense.amount),
        escapeCSVValue(expense.target_name),
        escapeCSVValue(expense.target_type),
        escapeCSVValue(expense.source_type),
        escapeCSVValue(expense.memo),
      ].join(','));
    }
    lines.push('');

    // Expenses total
    const expensesTotal = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    lines.push(`"EXPENSES TOTAL","",${formatCurrency(expensesTotal)},"","","",""`);
    lines.push('');

    // Section: Grand Totals
    lines.push('"=== GRAND TOTALS ==="');
    const grandTotalBudget = eventsTotalBudget + categoriesTotalBudget;
    const grandTotalActual = eventsTotalActual + categoriesTotalActual;
    const grandTotalRemaining = grandTotalBudget - grandTotalActual;
    lines.push(`"Total Budget",${formatCurrency(grandTotalBudget)}`);
    lines.push(`"Total Actual Spent",${formatCurrency(grandTotalActual)}`);
    lines.push(`"Total Remaining",${formatCurrency(grandTotalRemaining)}`);

    // Join all lines
    const csvContent = lines.join('\n');

    // Generate filename
    let scopeLabel = 'full-year';
    if (scope === 'quarter') scopeLabel = quarter.toLowerCase();
    else if (scope === 'month') scopeLabel = `month-${month.toString().padStart(2, '0')}`;
    else if (scope === 'custom') scopeLabel = 'custom-range';

    const filename = `counting-house-${fiscalYear}-${scopeLabel}.csv`;

    // Return as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 }
    );
  }
}
