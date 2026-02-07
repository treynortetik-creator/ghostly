/**
 * Cadence Milestones API
 *
 * POST /api/cadence-templates/:id/milestones - Add milestone to template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

const validChannels = ['scrooge', 'in_app', 'both'];

export async function POST(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const { id: templateId } = await context.params;
    const body = await request.json();

    if (!body.title || String(body.title).trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (body.offset_days === undefined || body.offset_days === null) {
      return NextResponse.json({ error: 'offset_days is required' }, { status: 400 });
    }

    const offsetDays = parseInt(body.offset_days);
    if (isNaN(offsetDays)) {
      return NextResponse.json({ error: 'offset_days must be an integer' }, { status: 400 });
    }

    if (body.notify_channel && !validChannels.includes(body.notify_channel)) {
      return NextResponse.json({ error: 'notify_channel must be scrooge, in_app, or both' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('cadence_milestones')
      .insert({
        template_id: templateId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        offset_days: offsetDays,
        notify_channel: body.notify_channel || 'both',
        display_order: body.display_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Add cadence milestone error:', err);
    logError('Failed to add cadence milestone', { error: err as Error, source: 'api/cadence-templates/[id]/milestones', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to add cadence milestone' }, { status: 500 });
  }
}
