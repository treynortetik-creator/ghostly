/**
 * Agent Memory API
 *
 * GET  /api/agent/memories?query=... - Semantic memory recall
 * POST /api/agent/memories - Store a memory snippet
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { recallAgentMemories, rememberAgentMemory } from '@/lib/agent/memory';

export const GET = withApiHandler({ permission: 'read', resource: 'agent/memories' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const query = String(searchParams.get('query') || '').trim();
    if (!query) {
      return NextResponse.json({ memories: [] });
    }

    const limit = Math.min(Math.max(Number(searchParams.get('limit') || '5'), 1), 20);
    const memories = await recallAgentMemories(orgId, query, limit);

    return NextResponse.json({ memories });
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'agent/memories' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    const content = String(body.content || '').trim();
    if (!content || content.length > 8000) {
      return NextResponse.json(
        { error: 'content must be 1-8000 characters' },
        { status: 400 }
      );
    }

    await rememberAgentMemory({
      orgId,
      sourceType: body.source_type ? String(body.source_type) : 'manual',
      sourceId: body.source_id ? String(body.source_id) : null,
      content,
      ttlDays: body.ttl_days ? Number(body.ttl_days) : 180,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    });

    return NextResponse.json({ success: true });
  }
);
