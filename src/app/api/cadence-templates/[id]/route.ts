/**
 * Cadence Template by ID
 *
 * GET /api/cadence-templates/:id - Get template with milestones
 * PUT /api/cadence-templates/:id - Update template
 * DELETE /api/cadence-templates/:id - Delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: template, error: templateError } = await supabase
      .from('cadence_templates')
      .select('*, event_types(name)')
      .eq('id', id)
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
  } catch (err) {
    console.error('Get cadence template error:', err);
    logError('Failed to get cadence template', { error: err as Error, source: 'api/cadence-templates/[id]', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to get cadence template' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.event_type_id !== undefined) updates.event_type_id = body.event_type_id || null;
    if (body.is_default !== undefined) updates.is_default = body.is_default;

    const { data, error } = await supabase
      .from('cadence_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Update cadence template error:', err);
    logError('Failed to update cadence template', { error: err as Error, source: 'api/cadence-templates/[id]', context: { method: 'PUT' } });
    return NextResponse.json({ error: 'Failed to update cadence template' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('cadence_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Cadence template deleted', id });
  } catch (err) {
    console.error('Delete cadence template error:', err);
    logError('Failed to delete cadence template', { error: err as Error, source: 'api/cadence-templates/[id]', context: { method: 'DELETE' } });
    return NextResponse.json({ error: 'Failed to delete cadence template' }, { status: 500 });
  }
}
