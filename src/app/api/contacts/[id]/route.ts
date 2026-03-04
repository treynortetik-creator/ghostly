/**
 * Ghostly - Contact by ID API
 *
 * GET /api/contacts/:id - Get single contact
 * PUT /api/contacts/:id - Update contact
 * DELETE /api/contacts/:id - Soft delete contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

const VALID_CONTACT_TYPES = ['vendor', 'lead', 'organizer', 'partner', 'other'];

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'contacts/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

export const PUT = withApiHandler({ permission: 'write', resource: 'contacts/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.first_name !== undefined) updates.first_name = body.first_name.trim();
    if (body.last_name !== undefined) updates.last_name = body.last_name.trim();
    if (body.company !== undefined) updates.company = body.company?.trim() || null;
    if (body.title !== undefined) updates.title = body.title?.trim() || null;
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
    if (body.contact_type !== undefined) {
      if (!VALID_CONTACT_TYPES.includes(body.contact_type)) {
        return NextResponse.json(
          { error: `Invalid contact_type. Must be one of: ${VALID_CONTACT_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
      updates.contact_type = body.contact_type;
    }
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
    if (body.last_contacted !== undefined) updates.last_contacted = body.last_contacted;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await auditMutation(request, {
      entity_type: 'contact',
      entity_id: id,
      action: 'update',
      changes: null,
    });

    return NextResponse.json(data);
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'contacts/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await auditMutation(request, {
      entity_type: 'contact',
      entity_id: id,
      action: 'delete',
      changes: null,
    });

    return NextResponse.json({ message: 'Contact deleted' });
  }
);
