/**
 * GET    /api/integrations/event-channels - List event-channel mappings
 * POST   /api/integrations/event-channels - Create/update mapping
 * DELETE /api/integrations/event-channels - Remove mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();
    const url = new URL(request.url);
    const eventId = url.searchParams.get('event_id');

    let query = supabase
      .from('integration_event_channels')
      .select('*')
      .eq('organization_id', orgId);

    if (eventId) query = query.eq('event_id', eventId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ event_channels: data || [] });
  }
);

export const POST = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (!body.event_id || !body.slack_channel_id) {
      return NextResponse.json({ error: 'event_id and slack_channel_id required' }, { status: 400 });
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
      .from('integration_event_channels')
      .upsert(
        {
          organization_id: orgId,
          integration_id: integration.id,
          event_id: body.event_id,
          slack_channel_id: body.slack_channel_id,
          slack_channel_name: body.slack_channel_name || '',
        },
        { onConflict: 'organization_id,integration_id,event_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ event_channel: data }, { status: 201 });
  }
);

export const DELETE = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (!body.event_id) {
      return NextResponse.json({ error: 'event_id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('integration_event_channels')
      .delete()
      .eq('organization_id', orgId)
      .eq('event_id', body.event_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  }
);
