/**
 * Pure business logic functions extracted for testing.
 * These are used across the codebase for CSV parsing, currency formatting,
 * duplicate detection, and input sanitization.
 */

// ============================================
// CSV PARSING
// ============================================

/**
 * Parse a single CSV line handling quoted fields (RFC 4180)
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Parse Brex CSV date from MM/DD/YYYY or YYYY-MM-DD format
 */
export function parseBrexDate(rawDate: string): string | null {
  const trimmed = rawDate.trim();
  if (!trimmed) return null;

  if (trimmed.includes('/')) {
    const [month, day, year] = trimmed.split('/');
    if (!month || !day || !year) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return trimmed;
}

/**
 * Parse a currency string, stripping $ and commas
 */
export function parseCurrencyAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, '').trim();
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Escape LIKE special characters to prevent wildcard injection
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * Escape a value for safe CSV output
 */
export function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Sanitize currency input - only allows digits and one decimal point
 */
export function sanitizeCurrencyInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
}

// ============================================
// DUPLICATE DETECTION
// ============================================

export interface DuplicateCandidate {
  id: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
}

export interface TransactionToCheck {
  amount: number;
  date: string;
  vendor: string;
}

/**
 * Check for duplicate expenses based on amount, date, and vendor.
 * Uses integer cents comparison for amount matching.
 */
export function findDuplicate(
  transaction: TransactionToCheck,
  existingExpenses: DuplicateCandidate[]
): DuplicateCandidate | undefined {
  return existingExpenses.find(exp => {
    // Compare cents as integers to avoid floating-point issues
    const amountMatch = Math.round(exp.amount * 100) === Math.round(transaction.amount * 100);

    const dateMatch = exp.expense_date === transaction.date;

    const vendorMatch = exp.vendor &&
      (exp.vendor.toLowerCase().includes(transaction.vendor.toLowerCase()) ||
        transaction.vendor.toLowerCase().includes(exp.vendor.toLowerCase()));

    return amountMatch && dateMatch && vendorMatch;
  });
}

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Format a number as currency with exactly 2 decimal places (for export/display)
 */
export function formatCurrencyFixed(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Format a number as USD currency using locale formatting
 */
export function formatCurrencyDisplay(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Round to cents for safe integer comparison
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
