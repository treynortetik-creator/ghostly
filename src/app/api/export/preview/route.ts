import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import type { QuarterType } from '@/types/database';

/* ============================================
   EXPORT PREVIEW API
   ============================================
   Returns counts and totals for the export
   preview based on the selected scope.
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

export const GET = withApiHandler({ permission: 'read', resource: 'export/preview' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') || 'year') as ExportScope;
    const fiscalYear = parseInt(searchParams.get('fiscal_year') || '2026', 10);
    const quarter = searchParams.get('quarter') || 'Q1';
    const month = parseInt(searchParams.get('month') || '1', 10);
    const dateStart = searchParams.get('date_start') || undefined;
    const dateEnd = searchParams.get('date_end') || undefined;

    const dateRange = getDateRangeForScope(scope, fiscalYear, quarter, month, dateStart, dateEnd);

    // Query events (scoped to org)
    let eventsQuery = supabase
      .from('events')
      .select('*')
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    if (scope === 'quarter') {
      eventsQuery = eventsQuery.eq('quarter', quarter as QuarterType);
    } else if (scope === 'month' || scope === 'custom') {
      eventsQuery = eventsQuery
        .gte('date_start', dateRange.start)
        .lte('date_start', dateRange.end);
    }

    const { data: events, error: eventsError } = await eventsQuery;
    if (eventsError) throw eventsError;

    // Query categories (scoped to org)
    const { data: categories, error: categoriesError } = await supabase
      .from('budget_categories')
      .select('*')
      .eq('organization_id', orgId)
      .is('deleted_at', null);
    if (categoriesError) throw categoriesError;

    // Query expenses within date range (scoped to org)
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('expense_date', dateRange.start)
      .lte('expense_date', dateRange.end);
    if (expensesError) throw expensesError;

    // Get expense totals per event
    const eventIds = (events || []).map(e => e.id);
    const eventExpenseTotals: Record<string, { total: number; count: number }> = {};
    for (const exp of expenses || []) {
      if (exp.event_id && exp.budget_bucket !== 'travel' && eventIds.includes(exp.event_id)) {
        if (!eventExpenseTotals[exp.event_id]) {
          eventExpenseTotals[exp.event_id] = { total: 0, count: 0 };
        }
        eventExpenseTotals[exp.event_id].total += exp.amount;
        eventExpenseTotals[exp.event_id].count += 1;
      }
    }

    // Get expense totals per category
    const categoryIds = (categories || []).map(c => c.id);
    const categoryExpenseTotals: Record<string, { total: number; count: number }> = {};
    const { data: allCategoryExpenses } = await supabase
      .from('expenses')
      .select('category_id, amount')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('category_id', categoryIds.length > 0 ? categoryIds : ['__none__']);

    for (const exp of allCategoryExpenses || []) {
      if (exp.category_id) {
        if (!categoryExpenseTotals[exp.category_id]) {
          categoryExpenseTotals[exp.category_id] = { total: 0, count: 0 };
        }
        categoryExpenseTotals[exp.category_id].total += exp.amount;
        categoryExpenseTotals[exp.category_id].count += 1;
      }
    }

    // Calculate totals
    const eventsTotals = {
      count: (events || []).length,
      totalBudget: (events || []).reduce((sum, e) => sum + (e.budget_amount || 0), 0),
      totalActual: (events || []).reduce((sum, e) => sum + (eventExpenseTotals[e.id]?.total || 0), 0),
      totalRemaining: (events || []).reduce((sum, e) => {
        const spent = eventExpenseTotals[e.id]?.total || 0;
        return sum + ((e.budget_amount || 0) - spent);
      }, 0),
    };

    const categoriesTotals = {
      count: (categories || []).length,
      totalBudget: (categories || []).reduce((sum, c) => sum + (c.budget_amount || 0), 0),
      totalActual: (categories || []).reduce((sum, c) => sum + (categoryExpenseTotals[c.id]?.total || 0), 0),
      totalRemaining: (categories || []).reduce((sum, c) => {
        const spent = categoryExpenseTotals[c.id]?.total || 0;
        return sum + ((c.budget_amount || 0) - spent);
      }, 0),
    };

    const expensesList = expenses || [];
    const expensesTotals = {
      count: expensesList.length,
      totalAmount: expensesList.reduce((sum, e) => sum + e.amount, 0),
      bySource: {
        manual: expensesList.filter(e => e.source_type === 'manual').length,
        brex: expensesList.filter(e => e.source_type === 'brex').length,
        pdf: expensesList.filter(e => e.source_type === 'pdf').length,
      },
    };

    return NextResponse.json({
      events: eventsTotals,
      categories: categoriesTotals,
      expenses: expensesTotals,
    });
  }
);
