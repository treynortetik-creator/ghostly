/**
 * Cadence Template by ID
 *
 * GET /api/cadence-templates/:id - Get template with milestones
 * PUT /api/cadence-templates/:id - Update template
 * DELETE /api/cadence-templates/:id - Delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'cadence-templates' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data: template, error: templateError } = await supabase
      .from('cadence_templates')
      .select('*, event_types(name)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: milestones } = await supabase
      .from('cadence_milestones')
      .select('*')
      .eq('template_id', id)
      .order('display_order', { ascending: true });

    return NextResponse.json({
      ...template,
      event_type_name: (template.event_types as { name: string } | null)?.name || null,
      event_types: undefined,
      milestones: milestones || [],
      milestone_count: (milestones || []).length,
    });
  }
);

export const PUT = withApiHandler({ permission: 'write', resource: 'cadence-templates' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.event_type_id !== undefined) updates.event_type_id = body.event_type_id || null;
    if (body.is_default !== undefined) updates.is_default = body.is_default;

    const { data, error } = await supabase
      .from('cadence_templates')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'cadence-templates' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { error } = await supabase
      .from('cadence_templates')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;

    return NextResponse.json({ message: 'Cadence template deleted', id });
  }
);
