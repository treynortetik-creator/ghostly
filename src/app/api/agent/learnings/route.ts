/**
 * Agent Learnings API
 *
 * GET  /api/agent/learnings - List learnings
 * POST /api/agent/learnings - Save a correction/preference learning
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { createClient } from '@/lib/supabase/server';
import { rememberLearning } from '@/lib/agent/memory';

export const GET = withApiHandler({ permission: 'read', resource: 'agent/learnings' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200);

    const { data, error } = await supabaseAny
      .from('agent_learnings')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ learnings: [] });
      }
      throw error;
    }

    return NextResponse.json({ learnings: data || [] });
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'agent/learnings' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    const correction = String(body.correction || '').trim();
    if (!correction || correction.length > 8000) {
      return NextResponse.json(
        { error: 'correction must be 1-8000 characters' },
        { status: 400 }
      );
    }

    const topic = body.topic ? String(body.topic).trim() : null;

    await rememberLearning({
      orgId,
      topic,
      correction,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    });

    return NextResponse.json({ success: true });
  }
);
