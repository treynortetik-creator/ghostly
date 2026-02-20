/**
 * The Firm - Event Team Assignment by ID
 *
 * PUT /api/events/:id/team/:assignmentId - Update assignment
 * DELETE /api/events/:id/team/:assignmentId - Remove assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string; assignmentId: string }> };

export const PUT = withApiHandler({ permission: 'write', resource: 'events/team' },
  async (request: NextRequest, context: RouteContext) => {
    const { id: eventId, assignmentId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.event_role !== undefined) updates.event_role = body.event_role?.trim() || null;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;

    const { data, error } = await supabase
      .from('event_team_assignments')
      .update(updates)
      .eq('id', assignmentId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'events/team' },
  async (_request: NextRequest, context: RouteContext) => {
    const { id: eventId, assignmentId } = await context.params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('event_team_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('event_id', eventId);

    if (error) throw error;

    return NextResponse.json({ message: 'Assignment removed' });
  }
);
