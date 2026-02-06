/**
 * The Firm - Event Team Assignments API
 *
 * GET /api/events/:id/team - Get team for an event
 * POST /api/events/:id/team - Assign team member to event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';
import { logAudit, getActor } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const { id: eventId } = await context.params;
    const supabase = await createClient();

    // Fetch assignments with team member details
    const { data: assignments, error } = await supabase
      .from('event_team_assignments')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Fetch team member details for each assignment
    const memberIds = (assignments || []).map(a => a.team_member_id);
    let members: Record<string, unknown>[] = [];
    if (memberIds.length > 0) {
      const { data: memberData } = await supabase
        .from('team_members')
        .select('*')
        .in('id', memberIds)
        .is('deleted_at', null);
      members = memberData || [];
    }

    const memberMap = new Map(members.map(m => [(m as { id: string }).id, m]));

    const result = (assignments || []).map(a => ({
      ...a,
      team_member: memberMap.get(a.team_member_id) || null,
    }));

    return NextResponse.json({ assignments: result });
  } catch (err) {
    console.error('Event team API error:', err);
    logError('Failed to fetch event team', { error: err as Error, source: 'api/events/[id]/team', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch event team' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const deniedPost = requirePermission(request, 'write');
  if (deniedPost) return deniedPost;

  try {
    const { id: eventId } = await context.params;
    const body = await request.json();

    if (!body.team_member_id) {
      return NextResponse.json({ error: 'team_member_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('event_team_assignments')
      .insert({
        event_id: eventId,
        team_member_id: body.team_member_id,
        event_role: body.event_role?.trim() || null,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Team member already assigned to this event' }, { status: 409 });
      }
      throw error;
    }

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      logAudit({ entity_type: 'event', entity_id: data.id, action: 'create', changes: null, actor, actor_type, metadata: { sub_type: 'team_assignment', event_id: eventId } });
    } catch (e) { console.error('Audit log failed:', e); }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Assign team member error:', err);
    logError('Failed to assign team member', { error: err as Error, source: 'api/events/[id]/team', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to assign team member' }, { status: 500 });
  }
}
