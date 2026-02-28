/**
 * Ghostly - Search API
 *
 * GET /api/search?q=query&types=events,expenses
 * Full-text search across events and expenses using ILIKE.
 * Results are grouped by type with match field and snippet info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

interface SearchResult {
  id: string;
  match_field: string;
  snippet: string;
  [key: string]: unknown;
}

interface SearchResponse {
  results: {
    events: SearchResult[];
    expenses: SearchResult[];
  };
  meta: {
    query: string;
    total: number;
  };
}

// Fields to search within events
const EVENT_SEARCH_FIELDS = [
  'name',
  'location',
  'approach_notes',
  'marketing_notes',
  'sales_notes',
] as const;

// Fields to search within expenses
const EXPENSE_SEARCH_FIELDS = [
  'vendor',
  'memo',
] as const;

/**
 * Build a snippet from the matched value, highlighting the area around the match.
 */
function buildSnippet(value: string, query: string, maxLen = 120): string {
  const lower = value.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return value.slice(0, maxLen);

  const start = Math.max(0, idx - 40);
  const end = Math.min(value.length, idx + query.length + 40);
  let snippet = value.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < value.length) snippet = snippet + '...';
  return snippet;
}

export const GET = withApiHandler({ permission: 'read', resource: 'search' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q')?.trim() || '';
    const typesParam = searchParams.get('types') || 'events,expenses';
    const types = typesParam.split(',').map(t => t.trim());
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!query || query.length < 2) {
      return NextResponse.json({
        results: { events: [], expenses: [] },
        meta: { query, total: 0 },
      });
    }

    const supabase = await createClient();
    const pattern = `%${query}%`;
    const response: SearchResponse = {
      results: { events: [], expenses: [] },
      meta: { query, total: 0 },
    };

    // Search events
    if (types.includes('events')) {
      const { data: events } = await supabase
        .from('events')
        .select('id, name, location, quarter, date_start, approach_notes, marketing_notes, sales_notes')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .or(
          EVENT_SEARCH_FIELDS.map(f => `${f}.ilike.${pattern}`).join(',')
        )
        .limit(limit);

      if (events) {
        for (const event of events) {
          // Find which field matched
          let matchField = 'name';
          let matchValue = event.name;

          for (const field of EVENT_SEARCH_FIELDS) {
            const val = event[field as keyof typeof event] as string | null;
            if (val && val.toLowerCase().includes(query.toLowerCase())) {
              matchField = field;
              matchValue = val;
              break;
            }
          }

          response.results.events.push({
            id: event.id,
            name: event.name,
            location: event.location,
            quarter: event.quarter,
            date_start: event.date_start,
            match_field: matchField,
            snippet: buildSnippet(matchValue, query),
          });
        }
      }
    }

    // Search expenses
    if (types.includes('expenses')) {
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, vendor, memo, amount, expense_date, event_id, category_id')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .or(
          EXPENSE_SEARCH_FIELDS.map(f => `${f}.ilike.${pattern}`).join(',')
        )
        .limit(limit);

      if (expenses) {
        for (const expense of expenses) {
          let matchField = 'vendor';
          let matchValue = expense.vendor || '';

          for (const field of EXPENSE_SEARCH_FIELDS) {
            const val = expense[field as keyof typeof expense] as string | null;
            if (val && val.toLowerCase().includes(query.toLowerCase())) {
              matchField = field;
              matchValue = val;
              break;
            }
          }

          response.results.expenses.push({
            id: expense.id,
            vendor: expense.vendor,
            memo: expense.memo,
            amount: expense.amount,
            expense_date: expense.expense_date,
            event_id: expense.event_id,
            category_id: expense.category_id,
            match_field: matchField,
            snippet: buildSnippet(matchValue, query),
          });
        }
      }
    }

    response.meta.total =
      response.results.events.length + response.results.expenses.length;

    return NextResponse.json(response);
  }
);
