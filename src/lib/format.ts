/**
 * Shared formatting utilities for Ghostly
 *
 * Canonical source for currency formatting.
 * Import from here instead of defining local helpers.
 */

// Re-export canonical sanitizer from business-logic
export { sanitizeCurrencyInput as sanitizeCurrency } from './business-logic';

/**
 * Format as USD with 2 decimal places: $1,234.56
 * Use for detail views, forms, and exact amounts.
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format as USD with no decimals: $1,235
 * Use for dashboard cards and summary views where space is tight.
 */
export function formatCurrencyCompact(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Parse a date string to a local Date, avoiding timezone shifts.
 * For date-only strings like "2026-03-15", appends T00:00:00 to
 * prevent UTC interpretation that shifts the day in western timezones.
 */
function parseLocalDate(dateStr: string): Date {
  // Date-only format: YYYY-MM-DD (exactly 10 chars, no T)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  return new Date(dateStr);
}

/**
 * Short date: "Mar 15" — for compact lists and cards
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014';
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Medium date: "Mar 15, 2026" — for tables and detail fields
 */
export function formatDateMedium(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014';
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Long date: "Sun, March 15, 2026" — for event detail headers
 */
export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBD';
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
