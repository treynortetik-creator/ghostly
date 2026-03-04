/**
 * Agent Background Tasks API
 *
 * GET  /api/agent/background-tasks - List background tasks
 * POST /api/agent/background-tasks - Queue a background task
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'agent/background-tasks' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('agent_background_tasks')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ tasks: [] });
      }
      throw error;
    }

    return NextResponse.json({ tasks: data || [] });
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'agent/background-tasks' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = createClient();

    const name = String(body.name || '').trim();
    const prompt = String(body.prompt || '').trim();

    if (!name || name.length > 120) {
      return NextResponse.json({ error: 'name must be 1-120 characters' }, { status: 400 });
    }

    if (!prompt || prompt.length > 4000) {
      return NextResponse.json({ error: 'prompt must be 1-4000 characters' }, { status: 400 });
    }

    let runAfter = new Date().toISOString();
    if (body.run_after) {
      const parsed = new Date(String(body.run_after));
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'run_after must be a valid timestamp' }, { status: 400 });
      }
      runAfter = parsed.toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('agent_background_tasks')
      .insert({
        organization_id: orgId,
        name,
        prompt,
        run_after: runAfter,
        status: 'pending',
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Background task table not initialized. Run latest DB migrations.' },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ task: data }, { status: 201 });
  }
);
