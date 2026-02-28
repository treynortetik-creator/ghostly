/**
 * Shared pagination utilities for Ghostly API routes.
 *
 * Eliminates duplicated page/per_page/offset parsing across routes.
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

/**
 * Parse pagination parameters from URL search params.
 *
 * @param searchParams - URLSearchParams from the request
 * @param defaultPageSize - Default items per page (default 50)
 * @param maxPageSize - Maximum allowed page size (default 200)
 * @returns Parsed pagination parameters
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultPageSize = 50,
  maxPageSize = 200,
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(searchParams.get('per_page') || String(defaultPageSize), 10) || defaultPageSize),
  );
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/**
 * Build a standard pagination meta object for API responses.
 */
export function paginationMeta(total: number, params: PaginationParams) {
  return {
    page: params.page,
    per_page: params.pageSize,
    total,
    total_pages: Math.ceil(total / params.pageSize),
  };
}

/**
 * Compute the Supabase `range(from, to)` values from pagination params.
 */
export function paginationRange(params: PaginationParams): { from: number; to: number } {
  return {
    from: params.offset,
    to: params.offset + params.pageSize - 1,
  };
}
