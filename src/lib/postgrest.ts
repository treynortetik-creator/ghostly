/**
 * Helpers for building safe PostgREST filter fragments from user input.
 */

/**
 * Escape LIKE wildcards and backslashes so user input is treated as literal text.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/**
 * Strip characters that can break PostgREST boolean/filter expressions.
 * This keeps `.or("...")` fragments stable and non-injectable.
 */
export function sanitizePostgrestFilterTerm(value: string, maxLength = 200): string {
  return value
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Build `field.ilike.%term%` OR clauses for trusted field names.
 * Returns null when the term has no usable characters.
 */
export function buildOrIlikeClause(fields: readonly string[], rawTerm: string): string | null {
  const sanitized = sanitizePostgrestFilterTerm(rawTerm);
  if (!sanitized) return null;
  const escaped = escapeLikePattern(sanitized);
  return fields.map((field) => `${field}.ilike.%${escaped}%`).join(',');
}
