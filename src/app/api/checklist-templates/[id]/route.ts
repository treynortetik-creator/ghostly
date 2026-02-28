/**
 * Ghostly - Checklist Template by ID
 *
 * GET /api/checklist-templates/:id - Get template with items
 * PUT /api/checklist-templates/:id - Update template
 * DELETE /api/checklist-templates/:id - Soft delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'checklist-templates' },
  async (_request: NextRequest, context: RouteContext) => {
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
  }
);

export const PUT = withApiHandler({ permission: 'write', resource: 'checklist-templates' },
  async (request: NextRequest, context: RouteContext) => {
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
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'checklist-templates' },
  async (_request: NextRequest, context: RouteContext) => {
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
  }
);
