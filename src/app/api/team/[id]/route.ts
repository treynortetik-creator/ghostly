/**
 * The Firm - Team Member by ID API
 *
 * GET /api/team/:id - Get single team member
 * PUT /api/team/:id - Update team member
 * DELETE /api/team/:id - Soft delete team member
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';
import { logAudit, getActor } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Get team member error:', err);
    logError('Failed to get team member', { error: err as Error, source: 'api/team/[id]', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to get team member' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const deniedPut = requirePermission(request, 'write');
  if (deniedPut) return deniedPut;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
    if (body.default_role !== undefined) updates.default_role = body.default_role?.trim() || null;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;

    const { data, error } = await supabase
      .from('team_members')
      .update(updates)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      logAudit({
        entity_type: 'team_member',
        entity_id: id,
        action: 'update',
        changes: null,
        actor,
        actor_type,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Update team member error:', err);
    logError('Failed to update team member', { error: err as Error, source: 'api/team/[id]', context: { method: 'PUT' } });
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const deniedDel = requirePermission(request, 'write');
  if (deniedDel) return deniedDel;

  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('team_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      logAudit({
        entity_type: 'team_member',
        entity_id: id,
        action: 'delete',
        changes: null,
        actor,
        actor_type,
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    return NextResponse.json({ message: 'Team member deleted' });
  } catch (err) {
    console.error('Delete team member error:', err);
    logError('Failed to delete team member', { error: err as Error, source: 'api/team/[id]', context: { method: 'DELETE' } });
    return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 });
  }
}
