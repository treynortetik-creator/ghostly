/**
 * Agent Tool API - Session History Search
 *
 * GET /api/agent/tools/session-history
 * Searches chat messages across sessions. Supports filtering by session,
 * keyword search, and result limiting. Joins through chat_sessions for org scoping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'agent-sessions' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const search = searchParams.get('search');
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(limitParam, 1), 50);

    const supabase = createClient();

    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        role,
        content,
        created_at,
        session_id,
        chat_sessions!inner(id, title, organization_id)
      `)
      .eq('chat_sessions.organization_id', orgId)
      .in('role', ['user', 'assistant'])
      .not('content', 'is', null);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    if (search) {
      query = query.ilike('content', `%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    const messages = (data ?? []).map((row: Record<string, unknown>) => {
      const session = row.chat_sessions as Record<string, unknown> | null;
      return {
        id: row.id,
        role: row.role,
        content: row.content,
        created_at: row.created_at,
        session_id: row.session_id,
        session_title: session?.title ?? null,
      };
    });

    return NextResponse.json({
      messages,
      total: messages.length,
    });
  }
);
