/**
 * The Firm - Template Item by ID
 *
 * PUT /api/checklist-templates/:id/items/:itemId - Update template item
 * DELETE /api/checklist-templates/:id/items/:itemId - Delete template item
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const deniedPut = requirePermission(request, 'write');
  if (deniedPut) return deniedPut;

  try {
    const { itemId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.phase !== undefined) updates.phase = body.phase;
    if (body.default_assignee_role !== undefined) updates.default_assignee_role = body.default_assignee_role?.trim() || null;
    if (body.days_offset !== undefined) updates.days_offset = body.days_offset != null ? parseInt(body.days_offset) : null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    const { data, error } = await supabase
      .from('checklist_template_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template item not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Update template item error:', err);
    logError('Failed to update template item', { error: err as Error, source: 'api/checklist-templates/[id]/items/[itemId]', context: { method: 'PUT' } });
    return NextResponse.json({ error: 'Failed to update template item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const deniedDel = requirePermission(request, 'write');
  if (deniedDel) return deniedDel;

  try {
    const { itemId } = await context.params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('checklist_template_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;

    return NextResponse.json({ message: 'Template item deleted' });
  } catch (err) {
    console.error('Delete template item error:', err);
    logError('Failed to delete template item', { error: err as Error, source: 'api/checklist-templates/[id]/items/[itemId]', context: { method: 'DELETE' } });
    return NextResponse.json({ error: 'Failed to delete template item' }, { status: 500 });
  }
}
