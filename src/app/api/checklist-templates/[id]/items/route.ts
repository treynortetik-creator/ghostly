/**
 * Ghostly - Checklist Template Items API
 *
 * POST /api/checklist-templates/:id/items - Add item to template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import type { ChecklistPhase } from '@/types/database';

type RouteContext = { params: Promise<{ id: string }> };

const validPhases: ChecklistPhase[] = ['pre_event', 'day_of', 'post_event'];

export const POST = withApiHandler({ permission: 'write', resource: 'checklist-template-items' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: templateId } = await context.params;
    const body = await request.json();

    if (!body.title || String(body.title).trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!body.phase || !validPhases.includes(body.phase)) {
      return NextResponse.json({ error: 'Valid phase is required (pre_event, day_of, post_event)' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify template belongs to org
    const { data: templateCheck } = await supabase.from('checklist_templates').select('id').eq('id', templateId).eq('organization_id', orgId).single();
    if (!templateCheck) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('checklist_template_items')
      .insert({
        template_id: templateId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        phase: body.phase as ChecklistPhase,
        default_assignee_role: body.default_assignee_role?.trim() || null,
        days_offset: body.days_offset != null ? parseInt(body.days_offset) : null,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  }
);
