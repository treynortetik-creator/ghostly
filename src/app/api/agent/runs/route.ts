/**
 * Agent Run Logs API
 *
 * GET /api/agent/runs - List recent agent executions for observability
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'agent/runs' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200);

    let query = supabaseAny
      .from('agent_runs')
      .select('*')
      .eq('organization_id', orgId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (source) query = query.eq('source', source);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ runs: [] });
      }
      throw error;
    }

    return NextResponse.json({ runs: data || [] });
  }
);
