import { describe, it, expect } from 'vitest';
import {
  parseCSVLine,
  parseBrexDate,
  parseCurrencyAmount,
  escapeLikePattern,
  escapeCSVValue,
  sanitizeCurrencyInput,
  findDuplicate,
  formatCurrencyFixed,
  toCents,
} from './business-logic';

// ============================================
// CSV PARSING
// ============================================

describe('parseCSVLine', () => {
  it('parses simple comma-separated values', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields containing commas', () => {
    expect(parseCSVLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(parseCSVLine('"He said ""hi""",b')).toEqual(['He said "hi"', 'b']);
  });

  it('handles empty fields', () => {
    expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
  });
});

describe('parseBrexDate', () => {
  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(parseBrexDate('01/15/2026')).toBe('2026-01-15');
  });

  it('pads single-digit month and day', () => {
    expect(parseBrexDate('3/5/2026')).toBe('2026-03-05');
  });

  it('passes through YYYY-MM-DD format', () => {
    expect(parseBrexDate('2026-03-15')).toBe('2026-03-15');
  });

  it('returns null for empty string', () => {
    expect(parseBrexDate('')).toBeNull();
  });
});

describe('parseCurrencyAmount', () => {
  it('parses dollar amounts with $ and commas', () => {
    expect(parseCurrencyAmount('$1,234.56')).toBe(1234.56);
  });

  it('parses plain numbers', () => {
    expect(parseCurrencyAmount('100.50')).toBe(100.50);
  });

  it('returns null for non-numeric input', () => {
    expect(parseCurrencyAmount('abc')).toBeNull();
  });
});

// ============================================
// INPUT SANITIZATION
// ============================================

describe('escapeLikePattern', () => {
  it('escapes % wildcard', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%');
  });

  it('escapes _ wildcard', () => {
    expect(escapeLikePattern('test_name')).toBe('test\\_name');
  });

  it('escapes backslash', () => {
    expect(escapeLikePattern('path\\file')).toBe('path\\\\file');
  });

  it('leaves normal strings unchanged', () => {
    expect(escapeLikePattern('Marriott Hotels')).toBe('Marriott Hotels');
  });
});

describe('escapeCSVValue', () => {
  it('wraps values with commas in quotes', () => {
    expect(escapeCSVValue('hello, world')).toBe('"hello, world"');
  });

  it('escapes internal double-quotes', () => {
    expect(escapeCSVValue('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('returns empty string for null', () => {
    expect(escapeCSVValue(null)).toBe('');
  });

  it('returns plain string when no special chars', () => {
    expect(escapeCSVValue('simple')).toBe('simple');
  });
});

describe('sanitizeCurrencyInput', () => {
  it('strips non-numeric characters except dots', () => {
    expect(sanitizeCurrencyInput('$1,234.56')).toBe('1234.56');
  });

  it('allows only one decimal point', () => {
    expect(sanitizeCurrencyInput('12.34.56')).toBe('12.3456');
  });

  it('handles plain numbers', () => {
    expect(sanitizeCurrencyInput('100')).toBe('100');
  });
});

// ============================================
// DUPLICATE DETECTION
// ============================================

describe('findDuplicate', () => {
  const existing = [
    { id: '1', amount: 150.00, expense_date: '2026-01-15', vendor: 'Marriott Hotels' },
    { id: '2', amount: 250.50, expense_date: '2026-02-01', vendor: 'Delta Airlines' },
  ];

  it('finds an exact match on amount, date, and vendor', () => {
    const result = findDuplicate(
      { amount: 150.00, date: '2026-01-15', vendor: 'Marriott Hotels' },
      existing
    );
    expect(result?.id).toBe('1');
  });

  it('matches vendor case-insensitively', () => {
    const result = findDuplicate(
      { amount: 150.00, date: '2026-01-15', vendor: 'marriott hotels' },
      existing
    );
    expect(result?.id).toBe('1');
  });

  it('matches partial vendor names (substring)', () => {
    const result = findDuplicate(
      { amount: 150.00, date: '2026-01-15', vendor: 'Marriott' },
      existing
    );
    expect(result?.id).toBe('1');
  });

  it('returns undefined when no match found', () => {
    const result = findDuplicate(
      { amount: 999.99, date: '2026-01-15', vendor: 'Unknown' },
      existing
    );
    expect(result).toBeUndefined();
  });

  it('uses integer cents comparison to avoid floating-point issues', () => {
    const expensesWithFloat = [
      { id: 'fp', amount: 0.1 + 0.2, expense_date: '2026-01-01', vendor: 'Test' },
    ];
    const result = findDuplicate(
      { amount: 0.3, date: '2026-01-01', vendor: 'Test' },
      expensesWithFloat
    );
    expect(result?.id).toBe('fp');
  });

  it('does not match when date differs', () => {
    const result = findDuplicate(
      { amount: 150.00, date: '2026-01-16', vendor: 'Marriott Hotels' },
      existing
    );
    expect(result).toBeUndefined();
  });
});

// ============================================
// CURRENCY FORMATTING
// ============================================

describe('formatCurrencyFixed', () => {
  it('formats to exactly 2 decimal places', () => {
    expect(formatCurrencyFixed(1234)).toBe('1234.00');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatCurrencyFixed(1234.567)).toBe('1234.57');
  });

  it('handles zero', () => {
    expect(formatCurrencyFixed(0)).toBe('0.00');
  });
});

describe('toCents', () => {
  it('converts dollars to cents', () => {
    expect(toCents(12.34)).toBe(1234);
  });

  it('handles floating-point edge cases', () => {
    // 0.1 + 0.2 !== 0.3 in floating point, but toCents should handle it
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('rounds to nearest cent', () => {
    expect(toCents(12.345)).toBe(1235);
  });
});
