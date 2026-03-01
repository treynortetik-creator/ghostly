/**
 * Ghostly - Document Templates API
 *
 * GET /api/templates - List all templates for the org
 * POST /api/templates - Create a template with sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import { withIdempotency } from '@/lib/idempotency';
import type { SectionContentType } from '@/types/database';

const VALID_CONTENT_TYPES = ['text', 'table', 'list', 'custom'];

export const GET = withApiHandler({ permission: 'read', resource: 'templates' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_templates')
      .select('*, template_sections(id)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const templates = (data || []).map((t) => ({
      ...t,
      section_count: t.template_sections?.length || 0,
      template_sections: undefined,
    }));

    return NextResponse.json({ templates });
  }
);

export const POST = withIdempotency(
  withApiHandler({ permission: 'write', resource: 'templates' },
    async (request: NextRequest) => {
      const orgId = getOrgId(request);
      const body = await request.json();

      if (!body.name || String(body.name).trim() === '') {
        return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
      }

      const sections = body.sections;
      if (!Array.isArray(sections) || sections.length === 0) {
        return NextResponse.json({ error: 'At least one section is required' }, { status: 400 });
      }

      for (const s of sections) {
        if (!s.title || String(s.title).trim() === '') {
          return NextResponse.json({ error: 'All sections must have a title' }, { status: 400 });
        }
        if (s.content_type && !VALID_CONTENT_TYPES.includes(s.content_type)) {
          return NextResponse.json({ error: `Invalid content_type: ${s.content_type}` }, { status: 400 });
        }
      }

      const supabase = await createClient();

      const { data: template, error: templateError } = await supabase
        .from('document_templates')
        .insert({
          organization_id: orgId,
          name: String(body.name).trim(),
          description: body.description ? String(body.description).trim() : null,
          is_default: false,
          created_by: body.created_by || null,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      const sectionRows = sections.map((s: Record<string, unknown>, i: number) => ({
        template_id: template.id,
        title: String(s.title).trim(),
        content_type: (s.content_type as SectionContentType) || 'text',
        ai_instructions: s.ai_instructions ? String(s.ai_instructions).trim() : null,
        default_content: s.default_content ? String(s.default_content).trim() : null,
        sort_order: i,
      }));

      const { data: insertedSections, error: sectionsError } = await supabase
        .from('template_sections')
        .insert(sectionRows)
        .select();

      if (sectionsError) throw sectionsError;

      await auditMutation(request, {
        entity_type: 'template',
        entity_id: template.id,
        action: 'create',
        changes: null,
      });

      return NextResponse.json({
        ...template,
        sections: insertedSections || [],
      }, { status: 201 });
    }
  )
);
