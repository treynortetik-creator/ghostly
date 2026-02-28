/**
 * Ghostly - Event Team Assignments API
 *
 * GET /api/events/:id/team - Get team for an event
 * POST /api/events/:id/team - Assign team member to event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'events/team' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const supabase = await createClient();

    // Verify event belongs to org
    const { data: eventCheck } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

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
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'events/team' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const body = await request.json();

    if (!body.team_member_id) {
      return NextResponse.json({ error: 'team_member_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify event belongs to org
    const { data: eventCheck } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

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
    await auditMutation(request, { entity_type: 'event', entity_id: data.id, action: 'create', changes: null, metadata: { sub_type: 'team_assignment', event_id: eventId } });

    return NextResponse.json(data, { status: 201 });
  }
);
