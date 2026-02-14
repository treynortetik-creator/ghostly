/**
 * Event Notes API
 *
 * GET  /api/events/:id/notes - List notes for an event
 * POST /api/events/:id/notes - Create a note on an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

const validNoteTypes = ['competitor_alert', 'general', 'logistics', 'budget', 'post_event'];

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const { id: eventId } = await context.params;
    const { searchParams } = new URL(request.url);
    const noteType = searchParams.get('note_type');
    const pinned = searchParams.get('pinned');
    const supabase = await createClient();

    let query = supabase
      .from('event_notes')
      .select('*')
      .eq('event_id', eventId)
      .is('deleted_at', null);

    if (noteType && validNoteTypes.includes(noteType)) {
      query = query.eq('note_type', noteType);
    }

    if (pinned === 'true') {
      query = query.eq('pinned', true);
    }

    const { data: notes, error } = await query.order('pinned', { ascending: false }).order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      notes: notes || [],
      meta: { total: (notes || []).length },
    });
  } catch (err) {
    console.error('Event notes API error:', err);
    logError('Failed to fetch event notes', { error: err as Error, source: 'api/events/[id]/notes', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch event notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const { id: eventId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    // Validate required fields
    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required and must be a non-empty string' }, { status: 400 });
    }

    if (!body.author || typeof body.author !== 'string' || body.author.trim().length === 0) {
      return NextResponse.json({ error: 'author is required and must be a non-empty string' }, { status: 400 });
    }

    if (body.note_type && !validNoteTypes.includes(body.note_type)) {
      return NextResponse.json({ error: `note_type must be one of: ${validNoteTypes.join(', ')}` }, { status: 400 });
    }

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: note, error } = await supabase
      .from('event_notes')
      .insert({
        event_id: eventId,
        author: body.author.trim(),
        note_type: body.note_type || 'general',
        title: body.title?.trim() || null,
        content: body.content.trim(),
        metadata: body.metadata || {},
        pinned: body.pinned || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error('Create event note error:', err);
    logError('Failed to create event note', { error: err as Error, source: 'api/events/[id]/notes', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to create event note' }, { status: 500 });
  }
}
