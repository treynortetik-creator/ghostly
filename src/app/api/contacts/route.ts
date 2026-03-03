/**
 * Ghostly - Contacts API
 *
 * GET /api/contacts - List all active contacts
 * POST /api/contacts - Create a new contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import { withIdempotency } from '@/lib/idempotency';
import { buildOrIlikeClause } from '@/lib/postgrest';
import type { ContactType } from '@/types/database';

const VALID_CONTACT_TYPES = ['vendor', 'lead', 'organizer', 'partner', 'other'];

export const GET = withApiHandler({ permission: 'read', resource: 'contacts' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const modifiedAfter = searchParams.get('modified_after');
    const idsParam = searchParams.get('ids');
    const contactType = searchParams.get('contact_type');
    const search = searchParams.get('search');

    if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }

    if (contactType && !VALID_CONTACT_TYPES.includes(contactType)) {
      return NextResponse.json(
        { error: `Invalid contact_type. Must be one of: ${VALID_CONTACT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const filters: Record<string, unknown> = {};

    const supabase = await createClient();

    let query = supabase
      .from('contacts')
      .select('*')
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    if (modifiedAfter) {
      filters.modified_after = modifiedAfter;
      query = query.gt('updated_at', modifiedAfter);
    }
    if (idsParam) {
      filters.ids = idsParam.split(',');
      query = query.in('id', idsParam.split(','));
    }
    if (contactType) {
      filters.contact_type = contactType;
      query = query.eq('contact_type', contactType as ContactType);
    }
    if (search) {
      filters.search = search;
      const searchClause = buildOrIlikeClause(
        ['first_name', 'last_name', 'company', 'email'],
        search
      );
      if (!searchClause) {
        return NextResponse.json({
          contacts: [],
          meta: {
            total: 0,
            filters_applied: filters,
          },
        });
      }
      query = query.or(searchClause);
    }

    const { data, error } = await query.order('last_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      contacts: data || [],
      meta: {
        total: data?.length || 0,
        filters_applied: filters,
      },
    });
  }
);

export const POST = withIdempotency(
  withApiHandler({ permission: 'write', resource: 'contacts' },
    async (request: NextRequest) => {
      const orgId = getOrgId(request);
      const body = await request.json();

      if (!body.first_name || String(body.first_name).trim() === '') {
        return NextResponse.json({ error: 'First name is required' }, { status: 400 });
      }
      if (!body.last_name || String(body.last_name).trim() === '') {
        return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
      }
      if (String(body.first_name).length > 200) {
        return NextResponse.json({ error: 'First name must be 200 characters or fewer' }, { status: 400 });
      }
      if (String(body.last_name).length > 200) {
        return NextResponse.json({ error: 'Last name must be 200 characters or fewer' }, { status: 400 });
      }
      if (body.contact_type && !VALID_CONTACT_TYPES.includes(body.contact_type)) {
        return NextResponse.json(
          { error: `Invalid contact_type. Must be one of: ${VALID_CONTACT_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const supabase = await createClient();

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          organization_id: orgId,
          first_name: body.first_name.trim(),
          last_name: body.last_name.trim(),
          company: body.company?.trim() || null,
          title: body.title?.trim() || null,
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
          contact_type: body.contact_type || 'other',
          notes: body.notes?.trim() || null,
          source: body.source?.trim() || 'manual',
          created_by: body.created_by?.trim() || null,
          metadata: body.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      await auditMutation(request, {
        entity_type: 'contact',
        entity_id: data.id,
        action: 'create',
        changes: null,
      });

      return NextResponse.json(data, { status: 201 });
    }
  )
);
