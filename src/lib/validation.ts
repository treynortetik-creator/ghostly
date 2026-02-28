/**
 * Shared validation constants for Ghostly API routes.
 *
 * Centralizes magic numbers that were previously duplicated across
 * multiple route files. Import from here instead of hardcoding.
 */

// ============================================
// STRING LENGTH LIMITS
// ============================================

export const VALIDATION = {
  /** Maximum length for entity names (events, categories, team members) */
  NAME_MAX_LENGTH: 200,
  /** Maximum length for vendor names on expenses */
  VENDOR_MAX_LENGTH: 200,
  /** Maximum length for description fields */
  DESCRIPTION_MAX_LENGTH: 2000,
  /** Maximum length for expense memo fields */
  MEMO_MAX_LENGTH: 2000,
  /** Maximum length for webhook/document URLs */
  URL_MAX_LENGTH: 2048,
  /** Maximum length for filenames */
  FILENAME_MAX_LENGTH: 200,
} as const;

// ============================================
// VALID ENUM VALUES
// ============================================

/** Valid webhook event types */
export const VALID_WEBHOOK_EVENT_TYPES = [
  'expense.created',
  'expense.updated',
  'expense.deleted',
  'event.created',
  'event.updated',
  'event.deleted',
  'budget.threshold_reached',
  '*',
] as const;

/** Valid expense source types */
export const VALID_EXPENSE_SOURCE_TYPES = ['manual', 'brex', 'pdf'] as const;

/** Valid quarter values */
export const VALID_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'] as const;
