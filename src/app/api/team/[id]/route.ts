/**
 * Ghostly - Team Member by ID API
 *
 * GET /api/team/:id - Get single team member
 * PUT /api/team/:id - Update team member
 * DELETE /api/team/:id - Soft delete team member
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'team/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

export const PUT = withApiHandler({ permission: 'write', resource: 'team/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

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
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Audit log
    await auditMutation(request, {
      entity_type: 'team_member',
      entity_id: id,
      action: 'update',
      changes: null,
    });

    return NextResponse.json(data);
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'team/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('team_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Audit log
    await auditMutation(request, {
      entity_type: 'team_member',
      entity_id: id,
      action: 'delete',
      changes: null,
    });

    return NextResponse.json({ message: 'Team member deleted' });
  }
);
