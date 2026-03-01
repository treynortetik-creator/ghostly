/**
 * GET  /api/integrations - List connected integrations for current org
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { getRegisteredIntegrations, ensureIntegrationsRegistered } from '@/lib/integrations/registry';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data: connected, error } = await supabase
      .from('integrations')
      .select('id, type, status, settings, installed_by, created_at, updated_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Include available integrations (registered but maybe not connected)
    await ensureIntegrationsRegistered();
    const available = getRegisteredIntegrations();

    return NextResponse.json({
      connected: connected || [],
      available,
    });
  }
);
