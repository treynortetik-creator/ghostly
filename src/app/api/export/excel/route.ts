import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { getDateRangeForScope, type ExportScope } from '@/lib/export-helpers';

type ExpenseExportRow = Record<string, unknown> & {
  events: { name: string } | null;
  budget_categories: { name: string } | null;
  event_id: string | null;
  category_id: string | null;
  amount: number;
  expense_date: string;
  vendor: string | null;
  source_type: string | null;
  source_reference: string | null;
  memo: string | null;
  budget_bucket: string | null;
};

type EventExportRow = Record<string, unknown> & {
  event_types: { name: string } | null;
};

/* ============================================
   EXCEL EXPORT API
   ============================================
   Returns a downloadable Excel workbook with
   multiple worksheets for events, categories,
   expenses, and summary.
   ============================================ */

export const GET = withApiHandler({ permission: 'read', resource: 'export/excel' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') || 'year') as ExportScope;
    const fiscalYear = parseInt(searchParams.get('fiscal_year') || String(new Date().getFullYear()), 10);
    const quarter = searchParams.get('quarter') || 'Q1';
    const month = parseInt(searchParams.get('month') || '1', 10);
    const dateStart = searchParams.get('date_start') || undefined;
    const dateEnd = searchParams.get('date_end') || undefined;

    const dateRange = getDateRangeForScope(scope, fiscalYear, quarter, month, dateStart, dateEnd);

    const supabase = await createClient();

    // Fetch all data from Supabase in parallel (scoped to org)
    const [
      { data: rawEvents, error: eventsErr },
      { data: rawCategories, error: catsErr },
      { data: rawExpenses, error: expErr },
    ] = await Promise.all([
      supabase.from('events').select('*, event_types(*)').eq('organization_id', orgId).is('deleted_at', null).limit(10000),
      supabase.from('budget_categories').select('*').eq('organization_id', orgId).is('deleted_at', null).limit(10000),
      supabase
        .from('expenses')
        .select('*, events(name), budget_categories(name)')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .gte('expense_date', dateRange.start)
        .lte('expense_date', dateRange.end)
        .limit(10000),
    ]);

    if (eventsErr || catsErr || expErr) throw eventsErr || catsErr || expErr;

    let allExpenses = (rawExpenses || []).map(e => {
      const { events: eventRel, budget_categories: catRel, ...rest } = e as unknown as ExpenseExportRow;
      return {
        ...rest,
        target_type: rest.event_id ? 'event' : 'category',
        target_name: eventRel?.name || catRel?.name || 'Unknown',
      };
    });

    // Build expense totals by event_id and category_id
    const expenseByEvent = new Map<string, { total: number; count: number }>();
    const expenseByCategory = new Map<string, { total: number; count: number }>();
    for (const exp of rawExpenses || []) {
      if (exp.event_id && exp.budget_bucket !== 'travel') {
        const prev = expenseByEvent.get(exp.event_id) || { total: 0, count: 0 };
        expenseByEvent.set(exp.event_id, { total: prev.total + exp.amount, count: prev.count + 1 });
      }
      if (exp.category_id) {
        const prev = expenseByCategory.get(exp.category_id) || { total: 0, count: 0 };
        expenseByCategory.set(exp.category_id, { total: prev.total + exp.amount, count: prev.count + 1 });
      }
    }

    // Compute events with totals
    const allEventsWithTotals = (rawEvents || []).map(event => {
      const stats = expenseByEvent.get(event.id) || { total: 0, count: 0 };
      const budgetAmount = event.budget_amount ?? 0;
      return {
        ...event,
        budget_amount: budgetAmount,
        actual_spent: stats.total,
        remaining: budgetAmount - stats.total,
        expense_count: stats.count,
      };
    });

    // Compute categories with totals
    const allCategories = (rawCategories || []).map(cat => {
      const stats = expenseByCategory.get(cat.id) || { total: 0, count: 0 };
      const budgetAmount = cat.budget_amount ?? 0;
      return {
        ...cat,
        budget_amount: budgetAmount,
        actual_spent: stats.total,
        remaining: budgetAmount - stats.total,
        expense_count: stats.count,
      };
    });

    // Filter events based on scope
    let filteredEvents = allEventsWithTotals;
    if (scope === 'quarter') {
      filteredEvents = allEventsWithTotals.filter(e => e.quarter === quarter);
    } else if (scope === 'month' || scope === 'custom') {
      filteredEvents = allEventsWithTotals.filter(e => {
        if (!e.date_start) return false;
        return e.date_start >= dateRange.start && e.date_start <= dateRange.end;
      });
    }

    // When filtering by quarter, also restrict expenses to filtered events only
    if (scope === 'quarter') {
      const filteredEventIds = new Set(filteredEvents.map(e => e.id));
      allExpenses = allExpenses.filter(e =>
        !e.event_id || filteredEventIds.has(e.event_id)
      );
    }

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // ============================================
    // SUMMARY WORKSHEET
    // ============================================
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    // Events totals
    const eventsTotalBudget = filteredEvents.reduce((sum, e) => sum + e.budget_amount, 0);
    const eventsTotalActual = filteredEvents.reduce((sum, e) => sum + e.actual_spent, 0);
    const eventsTotalRemaining = filteredEvents.reduce((sum, e) => sum + e.remaining, 0);

    // Categories totals
    const categoriesTotalBudget = allCategories.reduce((sum, c) => sum + c.budget_amount, 0);
    const categoriesTotalActual = allCategories.reduce((sum, c) => sum + c.actual_spent, 0);
    const categoriesTotalRemaining = allCategories.reduce((sum, c) => sum + c.remaining, 0);

    // Grand totals
    const grandTotalBudget = eventsTotalBudget + categoriesTotalBudget;
    const grandTotalActual = eventsTotalActual + categoriesTotalActual;
    const grandTotalRemaining = grandTotalBudget - grandTotalActual;

    const summaryRows: (string | number)[][] = [
      ['Ghostly - Export Report'],
      [''],
      ['Fiscal Year', fiscalYear],
      ['Export Date', new Date().toISOString().split('T')[0]],
      ['Scope', scope === 'year' ? 'Full Year' : scope === 'quarter' ? quarter : scope === 'month' ? `Month ${month}` : `${dateStart} to ${dateEnd}`],
      [''],
      ['=== GRAND TOTALS ==='],
      [''],
      ['Category', 'Budget', 'Actual Spent', 'Remaining'],
      ['Events', eventsTotalBudget, eventsTotalActual, eventsTotalRemaining],
      ['Categories', categoriesTotalBudget, categoriesTotalActual, categoriesTotalRemaining],
      [''],
      ['GRAND TOTAL', grandTotalBudget, grandTotalActual, grandTotalRemaining],
      [''],
      [''],
      ['=== EXPENSE BREAKDOWN ==='],
      [''],
      ['Total Expenses', allExpenses.length],
      ['Total Amount', allExpenses.reduce((sum, e) => sum + e.amount, 0)],
      [''],
      ['By Source:'],
      ['Manual Entries', allExpenses.filter(e => e.source_type === 'manual').length],
      ['Brex Imports', allExpenses.filter(e => e.source_type === 'brex').length],
      ['PDF Uploads', allExpenses.filter(e => e.source_type === 'pdf').length],
    ];
    for (const row of summaryRows) {
      summarySheet.addRow(row);
    }

    // ============================================
    // EVENTS WORKSHEET
    // ============================================
    const eventsSheet = workbook.addWorksheet('Events');
    eventsSheet.columns = [
      { header: 'Event Name', width: 35 },
      { header: 'Event Type', width: 12 },
      { header: 'Quarter', width: 8 },
      { header: 'Start Date', width: 12 },
      { header: 'End Date', width: 12 },
      { header: 'Location', width: 20 },
      { header: 'Budget', width: 12 },
      { header: 'Actual Spent', width: 12 },
      { header: 'Remaining', width: 12 },
      { header: 'Expense Count', width: 12 },
    ];

    for (const event of filteredEvents) {
      const eventTypeName = (event as unknown as EventExportRow).event_types?.name || 'Uncategorized';
      eventsSheet.addRow([
        event.name,
        eventTypeName,
        event.quarter || '',
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
    eventsSheet.addRow([]);
    eventsSheet.addRow([
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

    // ============================================
    // CATEGORIES WORKSHEET
    // ============================================
    const categoriesSheet = workbook.addWorksheet('Categories');
    categoriesSheet.columns = [
      { header: 'Category Name', width: 25 },
      { header: 'Description', width: 45 },
      { header: 'Budget', width: 12 },
      { header: 'Actual Spent', width: 12 },
      { header: 'Remaining', width: 12 },
      { header: 'Expense Count', width: 12 },
    ];

    for (const category of allCategories) {
      categoriesSheet.addRow([
        category.name,
        category.description || '',
        category.budget_amount,
        category.actual_spent,
        category.remaining,
        category.expense_count,
      ]);
    }

    // Add totals row
    categoriesSheet.addRow([]);
    categoriesSheet.addRow([
      'TOTAL',
      '',
      categoriesTotalBudget,
      categoriesTotalActual,
      categoriesTotalRemaining,
      allCategories.reduce((sum, c) => sum + c.expense_count, 0),
    ]);

    // ============================================
    // EXPENSES WORKSHEET
    // ============================================
    const expensesSheet = workbook.addWorksheet('Expenses');
    expensesSheet.columns = [
      { header: 'Date', width: 12 },
      { header: 'Vendor', width: 30 },
      { header: 'Amount', width: 12 },
      { header: 'Target Name', width: 35 },
      { header: 'Target Type', width: 10 },
      { header: 'Source', width: 10 },
      { header: 'Memo', width: 40 },
      { header: 'Source Reference', width: 20 },
    ];

    for (const expense of allExpenses) {
      expensesSheet.addRow([
        expense.expense_date,
        expense.vendor || '',
        expense.amount,
        expense.target_name,
        expense.target_type,
        expense.source_type || '',
        expense.memo || '',
        expense.source_reference || '',
      ]);
    }

    // Add totals row
    expensesSheet.addRow([]);
    expensesSheet.addRow([
      'TOTAL',
      '',
      allExpenses.reduce((sum, e) => sum + e.amount, 0),
      '',
      '',
      '',
      '',
      '',
    ]);

    // Generate the Excel file buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();

    // Generate filename
    let scopeLabel = 'full-year';
    if (scope === 'quarter') scopeLabel = quarter.toLowerCase();
    else if (scope === 'month') scopeLabel = `month-${month.toString().padStart(2, '0')}`;
    else if (scope === 'custom') scopeLabel = 'custom-range';

    const filename = `ghostly-${fiscalYear}-${scopeLabel}.xlsx`;

    // Return as downloadable file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }
);
