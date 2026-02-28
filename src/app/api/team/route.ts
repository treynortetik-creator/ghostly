/**
 * Ghostly - Team Members API
 *
 * GET /api/team - List all active team members
 * POST /api/team - Create a new team member
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';
import { withIdempotency } from '@/lib/idempotency';

export const GET = withApiHandler({ permission: 'read', resource: 'team' },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const modifiedAfter = searchParams.get('modified_after');
    const idsParam = searchParams.get('ids');

    // Validate modified_after if provided
    if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }

    const filters: {
      modified_after?: string;
      ids?: string[];
    } = {};

    if (modifiedAfter) {
      filters.modified_after = modifiedAfter;
    }
    if (idsParam) {
      filters.ids = idsParam.split(',');
    }

    const supabase = await createClient();

    let query = supabase
      .from('team_members')
      .select('*')
      .is('deleted_at', null);

    if (filters.modified_after) query = query.gt('updated_at', filters.modified_after);
    if (filters.ids) query = query.in('id', filters.ids);

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      team_members: data || [],
      meta: {
        total: data?.length || 0,
        filters_applied: filters,
      },
    });
  }
);

export const POST = withIdempotency(
  withApiHandler({ permission: 'write', resource: 'team' },
    async (request: NextRequest) => {
      const body = await request.json();

      if (!body.name || String(body.name).trim() === '') {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }

      if (String(body.name).length > 200) {
        return NextResponse.json({ error: 'Name must be 200 characters or fewer' }, { status: 400 });
      }

      const supabase = await createClient();

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          name: body.name.trim(),
          email: body.email?.trim() || null,
          phone: body.phone?.trim() || null,
          default_role: body.default_role?.trim() || null,
          is_active: body.is_active !== false,
          notes: body.notes?.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await auditMutation(request, {
        entity_type: 'team_member',
        entity_id: data.id,
        action: 'create',
        changes: null,
      });

      return NextResponse.json(data, { status: 201 });
    }
  )
);
