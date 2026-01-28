import { NextResponse } from 'next/server';
import { getEventsWithTotals } from '@/lib/mock-data/events';
import { getCategoriesWithTotals } from '@/lib/mock-data/categories';
import { getExpenses } from '@/lib/mock-data/expenses';

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

    // Get all events with totals
    const allEvents = getEventsWithTotals();

    // Filter events based on scope
    let filteredEvents = allEvents;
    if (scope === 'quarter') {
      filteredEvents = allEvents.filter(e => e.quarter === quarter);
    } else if (scope === 'month' || scope === 'custom') {
      // Filter by date range - events that fall within the range
      filteredEvents = allEvents.filter(e => {
        if (!e.date_start) return false;
        return e.date_start >= dateRange.start && e.date_start <= dateRange.end;
      });
    }

    // Get all categories with totals (not date-filtered, as they're yearly)
    const allCategories = getCategoriesWithTotals();

    // Get expenses within date range
    const allExpenses = getExpenses({
      date_start: dateRange.start,
      date_end: dateRange.end,
    });

    // Calculate totals
    const eventsTotals = {
      count: filteredEvents.length,
      totalBudget: filteredEvents.reduce((sum, e) => sum + e.budget_amount, 0),
      totalActual: filteredEvents.reduce((sum, e) => sum + e.actual_spent, 0),
      totalRemaining: filteredEvents.reduce((sum, e) => sum + e.remaining, 0),
    };

    const categoriesTotals = {
      count: allCategories.length,
      totalBudget: allCategories.reduce((sum, c) => sum + c.budget_amount, 0),
      totalActual: allCategories.reduce((sum, c) => sum + c.actual_spent, 0),
      totalRemaining: allCategories.reduce((sum, c) => sum + c.remaining, 0),
    };

    const expensesTotals = {
      count: allExpenses.length,
      totalAmount: allExpenses.reduce((sum, e) => sum + e.amount, 0),
      bySource: {
        manual: allExpenses.filter(e => e.source_type === 'manual').length,
        brex: allExpenses.filter(e => e.source_type === 'brex').length,
        pdf: allExpenses.filter(e => e.source_type === 'pdf').length,
      },
    };

    return NextResponse.json({
      events: eventsTotals,
      categories: categoriesTotals,
      expenses: expensesTotals,
    });
  } catch (error) {
    console.error('Export preview error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export preview' },
      { status: 500 }
    );
  }
}
