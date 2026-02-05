/**
 * The Firm - Checklist Template by ID
 *
 * GET /api/checklist-templates/:id - Get template with items
 * PUT /api/checklist-templates/:id - Update template
 * DELETE /api/checklist-templates/:id - Soft delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: template, error: templateError } = await supabase
      .from('checklist_templates')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { data: items } = await supabase
      .from('checklist_template_items')
      .select('*')
      .eq('template_id', id)
      .order('phase', { ascending: true })
      .order('sort_order', { ascending: true });

    return NextResponse.json({
      ...template,
      items: items || [],
      item_count: (items || []).length,
    });
  } catch (err) {
    console.error('Get template error:', err);
    logError('Failed to get template', { error: err as Error, source: 'api/checklist-templates/[id]', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to get template' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.event_type !== undefined) updates.event_type = body.event_type?.trim() || null;
    if (body.is_default !== undefined) updates.is_default = body.is_default;

    const { data, error } = await supabase
      .from('checklist_templates')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Update template error:', err);
    logError('Failed to update template', { error: err as Error, source: 'api/checklist-templates/[id]', context: { method: 'PUT' } });
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('checklist_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete template error:', err);
    logError('Failed to delete template', { error: err as Error, source: 'api/checklist-templates/[id]', context: { method: 'DELETE' } });
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
