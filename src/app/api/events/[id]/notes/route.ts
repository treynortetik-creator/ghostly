/**
 * Event Notes API
 *
 * GET  /api/events/:id/notes - List notes for an event
 * POST /api/events/:id/notes - Create a note on an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

const validNoteTypes = ['competitor_alert', 'general', 'logistics', 'budget', 'post_event'];

export const GET = withApiHandler({ permission: 'read', resource: 'events/notes' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const { searchParams } = new URL(request.url);
    const noteType = searchParams.get('note_type');
    const pinned = searchParams.get('pinned');
    const supabase = createClient();

    // Verify event belongs to org
    const { data: eventCheck } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!eventCheck) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

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
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'events/notes' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const body = await request.json();
    const supabase = createClient();

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

    // Verify event exists and belongs to org
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('organization_id', orgId)
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
  }
);
