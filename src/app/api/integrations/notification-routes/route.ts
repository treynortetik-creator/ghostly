/**
 * GET /api/integrations/notification-routes - Get routing config
 * PUT /api/integrations/notification-routes - Update routing config
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

const VALID_NOTIFICATION_TYPES = [
  'agent_message',
  'budget_alert',
  'task_reminder',
  'custom_reminder',
];

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data: routes, error } = await supabase
      .from('integration_notification_routes')
      .select('*')
      .eq('organization_id', orgId);

    if (error) throw error;

    return NextResponse.json({ routes: routes || [] });
  }
);

export const PUT = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (!Array.isArray(body.routes)) {
      return NextResponse.json({ error: 'routes must be an array' }, { status: 400 });
    }

    // Get the active Slack integration
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

    // Upsert each route
    const upsertData = body.routes
      .filter((r: { notification_type: string }) =>
        VALID_NOTIFICATION_TYPES.includes(r.notification_type)
      )
      .map((r: { notification_type: string; destination: string; is_enabled: boolean }) => ({
        organization_id: orgId,
        integration_id: integration.id,
        notification_type: r.notification_type,
        destination: r.destination || 'dm',
        is_enabled: r.is_enabled ?? true,
      }));

    const { error } = await supabase
      .from('integration_notification_routes')
      .upsert(upsertData, {
        onConflict: 'organization_id,integration_id,notification_type',
      });

    if (error) throw error;

    // Fetch updated routes
    const { data: routes } = await supabase
      .from('integration_notification_routes')
      .select('*')
      .eq('organization_id', orgId);

    return NextResponse.json({ routes: routes || [] });
  }
);
