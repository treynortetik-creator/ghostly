/**
 * Event Note by ID
 *
 * GET    /api/events/:id/notes/:noteId - Get single note
 * PATCH  /api/events/:id/notes/:noteId - Update a note
 * DELETE /api/events/:id/notes/:noteId - Soft delete a note
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

const validNoteTypes = ['competitor_alert', 'general', 'logistics', 'budget', 'post_event'];

export const GET = withApiHandler({ permission: 'read', resource: 'events/notes' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId, noteId } = await context.params;
    const supabase = createClient();

    // Verify event belongs to org
    const { data: eventCheck } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: note, error } = await supabase
      .from('event_notes')
      .select('*')
      .eq('id', noteId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single();

    if (error || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json(note);
  }
);

export const PATCH = withApiHandler({ permission: 'write', resource: 'events/notes' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId, noteId } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    // Verify event belongs to org
    const { data: eventCheck } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const updates: Record<string, unknown> = {};

    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.trim().length === 0) {
        return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 });
      }
      updates.content = body.content.trim();
    }

    if (body.title !== undefined) updates.title = body.title?.trim() || null;

    if (body.note_type !== undefined) {
      if (!validNoteTypes.includes(body.note_type)) {
        return NextResponse.json({ error: `note_type must be one of: ${validNoteTypes.join(', ')}` }, { status: 400 });
      }
      updates.note_type = body.note_type;
    }

    if (body.pinned !== undefined) updates.pinned = !!body.pinned;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: note, error } = await supabase
      .from('event_notes')
      .update(updates)
      .eq('id', noteId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json(note);
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'events/notes' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId, noteId } = await context.params;
    const supabase = createClient();

    // Verify event belongs to org
    const { data: eventCheck } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: note, error } = await supabase
      .from('event_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Note deleted', id: noteId });
  }
);
