/**
 * GET    /api/integrations/[id] - Get integration details
 * DELETE /api/integrations/[id] - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const orgId = getOrgId(request);
    const { id } = await params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('integrations')
      .select('id, type, status, settings, installed_by, created_at, updated_at')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({ integration: data });
  }
);

export const DELETE = withApiHandler(
  { permission: 'admin', resource: 'integrations' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const orgId = getOrgId(request);
    const { id } = await params;
    const supabase = createClient();

    // Soft disconnect — keep the record but mark inactive and clear credentials
    const { error } = await supabase
      .from('integrations')
      .update({
        status: 'disconnected' as const,
        credentials: {},
      })
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  }
);
