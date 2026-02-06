/**
 * Shared helpers for CSV and Excel export routes.
 */

// Re-export from business-logic for convenience
export { escapeCSVValue, formatCurrencyFixed } from '@/lib/business-logic';

// ============================================
// TYPES
// ============================================

export type ExportScope = 'year' | 'quarter' | 'month' | 'custom';

export interface DateRange {
  start: string;
  end: string;
}

// ============================================
// DATE RANGE CALCULATION
// ============================================

/**
 * Calculate start/end date strings for a given export scope.
 */
export function getDateRangeForScope(
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

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format a number to 2 decimal places for export output.
 */
export function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}
