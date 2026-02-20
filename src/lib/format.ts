/**
 * Shared formatting utilities for The Counting House
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
