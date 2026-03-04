/**
 * Ghostly - Current Organization API
 *
 * GET  /api/organizations/current — Returns the current organization details
 * PUT  /api/organizations/current — Updates the current organization name
 *
 * The org ID is resolved from the x-organization-id header (set by middleware).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId, auditMutation } from '@/lib/api-helpers';

// ============================================
// GET /api/organizations/current
// ============================================

export const GET = withApiHandler(
  { permission: 'read', resource: 'organization' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { data: org, error } = await supabase
      .from('organizations')
      .select('id, name, slug, plan_tier, settings, created_at, updated_at')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ organization: org });
  }
);

// ============================================
// PUT /api/organizations/current
// ============================================

export const PUT = withApiHandler(
  { permission: 'admin', resource: 'organization' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId)
      .select('id, name, slug, plan_tier, settings, created_at, updated_at')
      .single();

    if (error) {
      console.error('Failed to update organization:', error);
      return NextResponse.json(
        { error: 'Failed to update organization' },
        { status: 500 }
      );
    }

    await auditMutation(request, {
      entity_type: 'organization',
      entity_id: orgId,
      action: 'update',
      metadata: { name: name.trim() },
    });

    return NextResponse.json({ organization: org });
  }
);
