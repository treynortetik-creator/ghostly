/**
 * Ghostly Agent - Chat Sessions API
 *
 * GET /api/agent/sessions - List chat sessions for current org
 * POST /api/agent/sessions - Create a new session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

// ============================================
// GET /api/agent/sessions
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'agent-sessions' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    // Fetch sessions with message count and last message preview
    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('id, title, event_id, created_at, updated_at')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // For each session, get message count and last message
    const enrichedSessions = await Promise.all(
      (sessions ?? []).map(async (session) => {
        const [countResult, lastMsgResult] = await Promise.all([
          supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', session.id),
          supabase
            .from('chat_messages')
            .select('content, role')
            .eq('session_id', session.id)
            .in('role', ['user', 'assistant'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
        ]);

        return {
          ...session,
          message_count: countResult.count ?? 0,
          last_message: lastMsgResult.data?.content?.slice(0, 120) ?? null,
          last_message_role: lastMsgResult.data?.role ?? null,
        };
      })
    );

    return NextResponse.json({ sessions: enrichedSessions });
  }
);

// ============================================
// POST /api/agent/sessions
// ============================================

export const POST = withApiHandler({ permission: 'write', resource: 'agent-sessions' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json().catch(() => ({}));
    const supabase = createClient();

    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert({
        organization_id: orgId,
        title: body.title || 'New Chat',
        event_id: body.event_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(newSession, { status: 201 });
  }
);
