/**
 * The Firm - Checklist Templates API
 *
 * GET /api/checklist-templates - List all templates
 * POST /api/checklist-templates - Create template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modifiedAfter = searchParams.get('modified_after');

    // Validate modified_after if provided
    if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }

    const filters: { modified_after?: string } = {};
    if (modifiedAfter) {
      filters.modified_after = modifiedAfter;
    }

    const supabase = await createClient();

    let query = supabase
      .from('checklist_templates')
      .select('*')
      .is('deleted_at', null);

    if (filters.modified_after) query = query.gt('updated_at', filters.modified_after);

    const { data: templates, error } = await query.order('name', { ascending: true });

    if (error) throw error;

    // Get item counts per template
    const templateIds = (templates || []).map(t => t.id);
    let itemCounts = new Map<string, number>();

    if (templateIds.length > 0) {
      const { data: items } = await supabase
        .from('checklist_template_items')
        .select('template_id')
        .in('template_id', templateIds);

      for (const item of items || []) {
        itemCounts.set(item.template_id, (itemCounts.get(item.template_id) || 0) + 1);
      }
    }

    const result = (templates || []).map(t => ({
      ...t,
      item_count: itemCounts.get(t.id) || 0,
    }));

    return NextResponse.json({
      templates: result,
      meta: {
        total: result.length,
        filters_applied: filters,
      },
    });
  } catch (err) {
    console.error('Templates API error:', err);
    logError('Failed to fetch templates', { error: err as Error, source: 'api/checklist-templates', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || String(body.name).trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('checklist_templates')
      .insert({
        name: body.name.trim(),
        event_type: body.event_type?.trim() || null,
        is_default: body.is_default || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Create template error:', err);
    logError('Failed to create template', { error: err as Error, source: 'api/checklist-templates', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
