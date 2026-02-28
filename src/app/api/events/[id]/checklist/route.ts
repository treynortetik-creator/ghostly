/**
 * Ghostly - Event Checklist API
 *
 * GET /api/events/:id/checklist - Get event checklist items
 * POST /api/events/:id/checklist - Add individual checklist item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import type { ChecklistPhase } from '@/types/database';

type RouteContext = { params: Promise<{ id: string }> };

const validPhases: ChecklistPhase[] = ['pre_event', 'day_of', 'post_event'];

export const GET = withApiHandler({ permission: 'read', resource: 'events/checklist' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const supabase = await createClient();

    // Verify event belongs to org
    const { data: event } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data: items, error } = await supabase
      .from('event_checklist_items')
      .select('*')
      .eq('event_id', eventId)
      .order('phase', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Fetch assignee details
    const assigneeIds = [...new Set((items || []).map(i => i.assignee_id).filter(Boolean))];
    const assigneeMap = new Map<string, unknown>();

    if (assigneeIds.length > 0) {
      const { data: members } = await supabase
        .from('team_members')
        .select('*')
        .in('id', assigneeIds as string[]);

      for (const m of members || []) {
        assigneeMap.set((m as { id: string }).id, m);
      }
    }

    const result = (items || []).map(item => ({
      ...item,
      assignee: item.assignee_id ? assigneeMap.get(item.assignee_id) || null : null,
    }));

    // Group by phase
    const grouped = {
      pre_event: result.filter(i => i.phase === 'pre_event'),
      day_of: result.filter(i => i.phase === 'day_of'),
      post_event: result.filter(i => i.phase === 'post_event'),
    };

    const total = result.length;
    const completed = result.filter(i => i.completed_at).length;

    return NextResponse.json({
      items: result,
      grouped,
      total,
      completed,
    });
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'events/checklist' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const body = await request.json();

    if (!body.title || String(body.title).trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!body.phase || !validPhases.includes(body.phase)) {
      return NextResponse.json({ error: 'Valid phase is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify event belongs to org
    const { data: event } = await supabase.from('events').select('id').eq('id', eventId).eq('organization_id', orgId).single();
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('event_checklist_items')
      .insert({
        event_id: eventId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        phase: body.phase as ChecklistPhase,
        assignee_id: body.assignee_id || null,
        due_date: body.due_date || null,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log (non-blocking)
    await auditMutation(request, { entity_type: 'event', entity_id: data.id, action: 'create', changes: null, metadata: { sub_type: 'checklist_item' } });

    return NextResponse.json(data, { status: 201 });
  }
);
