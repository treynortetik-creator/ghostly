import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getEventsWithTotals } from '@/lib/mock-data/events';
import { getCategoriesWithTotals } from '@/lib/mock-data/categories';
import { getExpenses } from '@/lib/mock-data/expenses';

/* ============================================
   EXCEL EXPORT API
   ============================================
   Returns a downloadable Excel workbook with
   multiple worksheets for events, categories,
   expenses, and summary.
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

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // ============================================
    // SUMMARY WORKSHEET
    // ============================================
    const summaryData = [
      ['The Counting House - Export Report'],
      [''],
      ['Fiscal Year', fiscalYear],
      ['Export Date', new Date().toISOString().split('T')[0]],
      ['Scope', scope === 'year' ? 'Full Year' : scope === 'quarter' ? quarter : scope === 'month' ? `Month ${month}` : `${dateStart} to ${dateEnd}`],
      [''],
      ['=== GRAND TOTALS ==='],
      [''],
      ['Category', 'Budget', 'Actual Spent', 'Remaining'],
    ];

    // Events totals
    const eventsTotalBudget = filteredEvents.reduce((sum, e) => sum + e.budget_amount, 0);
    const eventsTotalActual = filteredEvents.reduce((sum, e) => sum + e.actual_spent, 0);
    const eventsTotalRemaining = filteredEvents.reduce((sum, e) => sum + e.remaining, 0);
    summaryData.push(['Events', eventsTotalBudget, eventsTotalActual, eventsTotalRemaining]);

    // Categories totals
    const categoriesTotalBudget = allCategories.reduce((sum, c) => sum + c.budget_amount, 0);
    const categoriesTotalActual = allCategories.reduce((sum, c) => sum + c.actual_spent, 0);
    const categoriesTotalRemaining = allCategories.reduce((sum, c) => sum + c.remaining, 0);
    summaryData.push(['Categories', categoriesTotalBudget, categoriesTotalActual, categoriesTotalRemaining]);

    // Grand totals
    const grandTotalBudget = eventsTotalBudget + categoriesTotalBudget;
    const grandTotalActual = eventsTotalActual + categoriesTotalActual;
    const grandTotalRemaining = grandTotalBudget - grandTotalActual;
    summaryData.push(['']);
    summaryData.push(['GRAND TOTAL', grandTotalBudget, grandTotalActual, grandTotalRemaining]);
    summaryData.push(['']);
    summaryData.push(['']);
    summaryData.push(['=== EXPENSE BREAKDOWN ===']);
    summaryData.push(['']);
    summaryData.push(['Total Expenses', allExpenses.length]);
    summaryData.push(['Total Amount', allExpenses.reduce((sum, e) => sum + e.amount, 0)]);
    summaryData.push(['']);
    summaryData.push(['By Source:']);
    summaryData.push(['Manual Entries', allExpenses.filter(e => e.source_type === 'manual').length]);
    summaryData.push(['Brex Imports', allExpenses.filter(e => e.source_type === 'brex').length]);
    summaryData.push(['PDF Uploads', allExpenses.filter(e => e.source_type === 'pdf').length]);

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths for summary
    summarySheet['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // ============================================
    // EVENTS WORKSHEET
    // ============================================
    const eventsData = [
      ['Event Name', 'Event Type', 'Quarter', 'Start Date', 'End Date', 'Location', 'Budget', 'Actual Spent', 'Remaining', 'Expense Count'],
    ];

    for (const event of filteredEvents) {
      eventsData.push([
        event.name,
        event.event_type,
        event.quarter,
        event.date_start || '',
        event.date_end || '',
        event.location || '',
        event.budget_amount,
        event.actual_spent,
        event.remaining,
        event.expense_count,
      ]);
    }

    // Add totals row
    eventsData.push([]);
    eventsData.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      eventsTotalBudget,
      eventsTotalActual,
      eventsTotalRemaining,
      filteredEvents.reduce((sum, e) => sum + e.expense_count, 0),
    ]);

    const eventsSheet = XLSX.utils.aoa_to_sheet(eventsData);

    // Set column widths for events
    eventsSheet['!cols'] = [
      { wch: 35 }, // Event Name
      { wch: 12 }, // Event Type
      { wch: 8 },  // Quarter
      { wch: 12 }, // Start Date
      { wch: 12 }, // End Date
      { wch: 20 }, // Location
      { wch: 12 }, // Budget
      { wch: 12 }, // Actual Spent
      { wch: 12 }, // Remaining
      { wch: 12 }, // Expense Count
    ];

    XLSX.utils.book_append_sheet(workbook, eventsSheet, 'Events');

    // ============================================
    // CATEGORIES WORKSHEET
    // ============================================
    const categoriesData = [
      ['Category Name', 'Description', 'Budget', 'Actual Spent', 'Remaining', 'Expense Count'],
    ];

    for (const category of allCategories) {
      categoriesData.push([
        category.name,
        category.description || '',
        category.budget_amount,
        category.actual_spent,
        category.remaining,
        category.expense_count,
      ]);
    }

    // Add totals row
    categoriesData.push([]);
    categoriesData.push([
      'TOTAL',
      '',
      categoriesTotalBudget,
      categoriesTotalActual,
      categoriesTotalRemaining,
      allCategories.reduce((sum, c) => sum + c.expense_count, 0),
    ]);

    const categoriesSheet = XLSX.utils.aoa_to_sheet(categoriesData);

    // Set column widths for categories
    categoriesSheet['!cols'] = [
      { wch: 25 }, // Category Name
      { wch: 45 }, // Description
      { wch: 12 }, // Budget
      { wch: 12 }, // Actual Spent
      { wch: 12 }, // Remaining
      { wch: 12 }, // Expense Count
    ];

    XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categories');

    // ============================================
    // EXPENSES WORKSHEET
    // ============================================
    const expensesData = [
      ['Date', 'Vendor', 'Amount', 'Target Name', 'Target Type', 'Source', 'Memo', 'Source Reference'],
    ];

    for (const expense of allExpenses) {
      expensesData.push([
        expense.expense_date,
        expense.vendor || '',
        expense.amount,
        expense.target_name,
        expense.target_type,
        expense.source_type,
        expense.memo || '',
        expense.source_reference || '',
      ]);
    }

    // Add totals row
    expensesData.push([]);
    expensesData.push([
      'TOTAL',
      '',
      allExpenses.reduce((sum, e) => sum + e.amount, 0),
      '',
      '',
      '',
      '',
      '',
    ]);

    const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);

    // Set column widths for expenses
    expensesSheet['!cols'] = [
      { wch: 12 }, // Date
      { wch: 30 }, // Vendor
      { wch: 12 }, // Amount
      { wch: 35 }, // Target Name
      { wch: 10 }, // Target Type
      { wch: 10 }, // Source
      { wch: 40 }, // Memo
      { wch: 20 }, // Source Reference
    ];

    XLSX.utils.book_append_sheet(workbook, expensesSheet, 'Expenses');

    // Generate the Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Generate filename
    let scopeLabel = 'full-year';
    if (scope === 'quarter') scopeLabel = quarter.toLowerCase();
    else if (scope === 'month') scopeLabel = `month-${month.toString().padStart(2, '0')}`;
    else if (scope === 'custom') scopeLabel = 'custom-range';

    const filename = `counting-house-${fiscalYear}-${scopeLabel}.xlsx`;

    // Return as downloadable file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel export' },
      { status: 500 }
    );
  }
}
