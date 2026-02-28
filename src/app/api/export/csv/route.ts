import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { getDateRangeForScope, formatCurrency, escapeCSVValue, type ExportScope } from '@/lib/export-helpers';

/* ============================================
   CSV EXPORT API
   ============================================
   Returns a downloadable CSV file containing
   all expense records for the selected scope.
   ============================================ */

export const GET = withApiHandler({ permission: 'read', resource: 'export/csv' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') || 'year') as ExportScope;
    const fiscalYear = parseInt(searchParams.get('fiscal_year') || '2026', 10);
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
      supabase.from('events').select('*, event_types(*)').eq('organization_id', orgId).is('deleted_at', null),
      supabase.from('budget_categories').select('*').eq('organization_id', orgId).is('deleted_at', null),
      supabase
        .from('expenses')
        .select('*, events(name), budget_categories(name)')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .gte('expense_date', dateRange.start)
        .lte('expense_date', dateRange.end),
    ]);

    if (eventsErr || catsErr || expErr) throw eventsErr || catsErr || expErr;

    let allExpenses = (rawExpenses || []).map(e => {
      const { events: eventRel, budget_categories: catRel, ...rest } = e as any;
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
      if (exp.event_id) {
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
    // This prevents expenses from unrelated events leaking in via date range overlap
    if (scope === 'quarter') {
      const filteredEventIds = new Set(filteredEvents.map(e => e.id));
      allExpenses = allExpenses.filter(e =>
        !e.event_id || filteredEventIds.has(e.event_id)
      );
    }

    // Build CSV content
    const lines: string[] = [];

    // Title and metadata
    lines.push(`"Ghostly - Export Report"`);
    lines.push(`"Fiscal Year ${fiscalYear}"`);
    lines.push(`"Export Date: ${new Date().toISOString().split('T')[0]}"`);
    lines.push(`"Scope: ${scope === 'year' ? 'Full Year' : scope === 'quarter' ? quarter : scope === 'month' ? `Month ${month}` : `${dateStart} to ${dateEnd}`}"`);
    lines.push('');

    // Section: Events Summary
    lines.push('"=== EVENTS SUMMARY ==="');
    lines.push('"Event Name","Event Type","Quarter","Budget","Actual Spent","Remaining","Location"');
    for (const event of filteredEvents) {
      const eventTypeName = (event as any).event_types?.name || 'Uncategorized';
      lines.push([
        escapeCSVValue(event.name),
        escapeCSVValue(eventTypeName),
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

    const filename = `ghostly-${fiscalYear}-${scopeLabel}.csv`;

    // Return as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }
);
