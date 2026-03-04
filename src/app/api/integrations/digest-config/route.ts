/**
 * GET /api/integrations/digest-config - Get digest settings
 * PUT /api/integrations/digest-config - Update digest settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('integration_digest_config')
      .select('*')
      .eq('organization_id', orgId);

    if (error) throw error;
    return NextResponse.json({ digests: data || [] });
  }
);

export const PUT = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = createClient();

    if (!body.digest_type || !['daily', 'weekly'].includes(body.digest_type)) {
      return NextResponse.json({ error: 'digest_type must be daily or weekly' }, { status: 400 });
    }

    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'slack')
      .eq('status', 'active')
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'No active Slack integration' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('integration_digest_config')
      .upsert({
        organization_id: orgId,
        integration_id: integration.id,
        digest_type: body.digest_type as 'daily' | 'weekly',
        is_enabled: body.is_enabled ?? false,
        send_time: body.send_time || '09:00:00',
        day_of_week: body.day_of_week ?? 1,
      }, {
        onConflict: 'organization_id,integration_id,digest_type',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ digest: data });
  }
);
