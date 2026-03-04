/**
 * Ghostly - Audit Log API
 *
 * Endpoints:
 * GET /api/audit-log - Query audit log entries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { parsePagination, paginationMeta, paginationRange } from '@/lib/pagination';

// ============================================
// GET /api/audit-log
// ============================================

export const GET = withApiHandler({ permission: 'admin', resource: 'audit-log' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    // Parse filter parameters
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const actor = searchParams.get('actor');
    const action = searchParams.get('action');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Parse pagination parameters
    const pagination = parsePagination(searchParams);
    const { from: rangeFrom, to: rangeTo } = paginationRange(pagination);

    const supabase = createClient();

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId);

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
      pagination: paginationMeta(total, pagination),
    });
  }
);
