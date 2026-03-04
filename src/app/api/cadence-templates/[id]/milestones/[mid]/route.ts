/**
 * Cadence Milestone by ID
 *
 * PUT /api/cadence-templates/:id/milestones/:mid - Update milestone
 * DELETE /api/cadence-templates/:id/milestones/:mid - Delete milestone
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string; mid: string }> };

const validChannels = ['agent', 'in_app', 'both'];

export const PUT = withApiHandler({ permission: 'write', resource: 'cadence-milestones' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: templateId, mid } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    // Verify template belongs to org
    const { data: templateCheck } = await supabase.from('cadence_templates').select('id').eq('id', templateId).eq('organization_id', orgId).single();
    if (!templateCheck) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.offset_days !== undefined) {
      const offsetDays = parseInt(body.offset_days);
      if (isNaN(offsetDays)) {
        return NextResponse.json({ error: 'offset_days must be an integer' }, { status: 400 });
      }
      updates.offset_days = offsetDays;
    }
    if (body.notify_channel !== undefined) {
      if (!validChannels.includes(body.notify_channel)) {
        return NextResponse.json({ error: 'notify_channel must be agent, in_app, or both' }, { status: 400 });
      }
      updates.notify_channel = body.notify_channel;
    }
    if (body.display_order !== undefined) updates.display_order = body.display_order;

    const { data, error } = await supabase
      .from('cadence_milestones')
      .update(updates)
      .eq('id', mid)
      .eq('template_id', templateId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'cadence-milestones' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: templateId, mid } = await context.params;
    const supabase = createClient();

    // Verify template belongs to org
    const { data: templateCheck } = await supabase.from('cadence_templates').select('id').eq('id', templateId).eq('organization_id', orgId).single();
    if (!templateCheck) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const { error } = await supabase
      .from('cadence_milestones')
      .delete()
      .eq('id', mid)
      .eq('template_id', templateId);

    if (error) throw error;

    return NextResponse.json({ message: 'Milestone deleted', id: mid });
  }
);
