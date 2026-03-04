/**
 * Cadence Templates API
 *
 * GET /api/cadence-templates - List all cadence templates
 * POST /api/cadence-templates - Create a cadence template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'cadence-templates' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { data: templates, error } = await supabase
      .from('cadence_templates')
      .select('*, event_types(name)')
      .eq('organization_id', orgId)
      .order('name', { ascending: true });

    if (error) throw error;

    // Get milestone counts per template
    const templateIds = (templates || []).map(t => t.id);
    const milestoneCounts = new Map<string, number>();

    if (templateIds.length > 0) {
      const { data: milestones } = await supabase
        .from('cadence_milestones')
        .select('template_id')
        .in('template_id', templateIds);

      for (const m of milestones || []) {
        milestoneCounts.set(m.template_id, (milestoneCounts.get(m.template_id) || 0) + 1);
      }
    }

    const result = (templates || []).map(t => ({
      ...t,
      event_type_name: (t.event_types as { name: string } | null)?.name || null,
      event_types: undefined,
      milestone_count: milestoneCounts.get(t.id) || 0,
    }));

    return NextResponse.json({
      templates: result,
      meta: { total: result.length },
    });
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'cadence-templates' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    if (!body.name || String(body.name).trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('cadence_templates')
      .insert({
        organization_id: orgId,
        name: body.name.trim(),
        event_type_id: body.event_type_id || null,
        is_default: body.is_default || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  }
);
