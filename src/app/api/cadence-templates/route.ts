/**
 * Cadence Templates API
 *
 * GET /api/cadence-templates - List all cadence templates
 * POST /api/cadence-templates - Create a cadence template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const supabase = await createClient();

    const { data: templates, error } = await supabase
      .from('cadence_templates')
      .select('*, event_types(name)')
      .order('name', { ascending: true });

    if (error) throw error;

    // Get milestone counts per template
    const templateIds = (templates || []).map(t => t.id);
    let milestoneCounts = new Map<string, number>();

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
  } catch (err) {
    console.error('Cadence templates API error:', err);
    logError('Failed to fetch cadence templates', { error: err as Error, source: 'api/cadence-templates', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch cadence templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const body = await request.json();

    if (!body.name || String(body.name).trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('cadence_templates')
      .insert({
        name: body.name.trim(),
        event_type_id: body.event_type_id || null,
        is_default: body.is_default || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Create cadence template error:', err);
    logError('Failed to create cadence template', { error: err as Error, source: 'api/cadence-templates', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to create cadence template' }, { status: 500 });
  }
}
