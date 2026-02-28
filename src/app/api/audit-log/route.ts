/**
 * Ghostly - Audit Log API
 *
 * Endpoints:
 * GET /api/audit-log - Query audit log entries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from '@/lib/api-helpers';

// ============================================
// GET /api/audit-log
// ============================================

export const GET = withApiHandler({ permission: 'admin', resource: 'audit-log' },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const actor = searchParams.get('actor');
    const action = searchParams.get('action');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Parse pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));
    const rangeFrom = (page - 1) * perPage;
    const rangeTo = rangeFrom + perPage - 1;

    const supabase = await createClient();

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' });

    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    if (actor) query = query.eq('actor', actor);
    if (action) query = query.eq('action', action);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    query = query.order('created_at', { ascending: false });
    query = query.range(rangeFrom, rangeTo);

    const { data: entries, error, count: totalCount } = await query;

    if (error) throw error;

    const total = totalCount ?? 0;

    return NextResponse.json({
      entries: entries || [],
      meta: { total },
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    });
  }
);
