/**
 * Ghostly Agent - Single Chat Session API
 *
 * GET /api/agent/sessions/[id] - Get session with all messages
 * DELETE /api/agent/sessions/[id] - Delete session and its messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

// ============================================
// GET /api/agent/sessions/[id]
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'agent-sessions' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = await createClient();

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    return NextResponse.json({
      session,
      messages: messages ?? [],
    });
  }
);

// ============================================
// DELETE /api/agent/sessions/[id]
// ============================================

export const DELETE = withApiHandler({ permission: 'write', resource: 'agent-sessions' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = await createClient();

    // Verify session belongs to this org
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Delete messages first (cascade should handle this, but be explicit)
    await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', id);

    // Delete session
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  }
);
