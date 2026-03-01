/**
 * Ghostly - Single Template API
 *
 * GET /api/templates/[id] - Get template with sections
 * PUT /api/templates/[id] - Update template and upsert sections
 * DELETE /api/templates/[id] - Soft delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import type { SectionContentType } from '@/types/database';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_CONTENT_TYPES = ['text', 'table', 'list', 'custom'];

export const GET = withApiHandler({ permission: 'read', resource: 'templates/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_templates')
      .select('*, template_sections(*)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const sections = (data.template_sections || []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    );

    return NextResponse.json({ ...data, sections, template_sections: undefined });
  }
);

export const PUT = withApiHandler({ permission: 'write', resource: 'templates/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const { data: existing, error: findError } = await supabase
      .from('document_templates')
      .select('id, is_default')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Validate sections BEFORE any DB writes
    if (Array.isArray(body.sections)) {
      for (const s of body.sections) {
        if (!s.title || String(s.title).trim() === '') {
          return NextResponse.json({ error: 'All sections must have a title' }, { status: 400 });
        }
        if (s.content_type && !VALID_CONTENT_TYPES.includes(s.content_type)) {
          return NextResponse.json({ error: `Invalid content_type: ${s.content_type}` }, { status: 400 });
        }
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null;

    const { error: updateError } = await supabase
      .from('document_templates')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    if (Array.isArray(body.sections)) {
      await supabase
        .from('template_sections')
        .delete()
        .eq('template_id', id);

      if (body.sections.length > 0) {
        const sectionRows = body.sections.map((s: Record<string, unknown>, i: number) => ({
          template_id: id,
          title: String(s.title).trim(),
          content_type: (s.content_type as SectionContentType) || 'text',
          ai_instructions: s.ai_instructions ? String(s.ai_instructions).trim() : null,
          default_content: s.default_content ? String(s.default_content).trim() : null,
          sort_order: i,
        }));

        const { error: insertError } = await supabase
          .from('template_sections')
          .insert(sectionRows);

        if (insertError) throw insertError;
      }
    }

    const { data: updated, error: fetchError } = await supabase
      .from('document_templates')
      .select('*, template_sections(*)')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const sections = (updated.template_sections || []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    );

    await auditMutation(request, {
      entity_type: 'template',
      entity_id: id,
      action: 'update',
      changes: null,
    });

    return NextResponse.json({ ...updated, sections, template_sections: undefined });
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'templates/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: existing, error: findError } = await supabase
      .from('document_templates')
      .select('id, is_default')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existing.is_default) {
      return NextResponse.json({ error: 'Default templates cannot be deleted' }, { status: 400 });
    }

    const { error } = await supabase
      .from('document_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await auditMutation(request, {
      entity_type: 'template',
      entity_id: id,
      action: 'delete',
      changes: null,
    });

    return NextResponse.json({ success: true });
  }
);
