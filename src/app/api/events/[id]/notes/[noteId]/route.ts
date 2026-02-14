/**
 * Event Note by ID
 *
 * GET    /api/events/:id/notes/:noteId - Get single note
 * PATCH  /api/events/:id/notes/:noteId - Update a note
 * DELETE /api/events/:id/notes/:noteId - Soft delete a note
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

const validNoteTypes = ['competitor_alert', 'general', 'logistics', 'budget', 'post_event'];

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const { id: eventId, noteId } = await context.params;
    const supabase = await createClient();

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
  } catch (err) {
    console.error('Get note error:', err);
    logError('Failed to fetch note', { error: err as Error, source: 'api/events/[id]/notes/[noteId]', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const { id: eventId, noteId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

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
  } catch (err) {
    console.error('Update note error:', err);
    logError('Failed to update note', { error: err as Error, source: 'api/events/[id]/notes/[noteId]', context: { method: 'PATCH' } });
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const { id: eventId, noteId } = await context.params;
    const supabase = await createClient();

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
  } catch (err) {
    console.error('Delete note error:', err);
    logError('Failed to delete note', { error: err as Error, source: 'api/events/[id]/notes/[noteId]', context: { method: 'DELETE' } });
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
