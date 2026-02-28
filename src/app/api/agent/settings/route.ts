/**
 * Ghostly Agent - Settings API
 *
 * GET /api/agent/settings - Get agent settings for current org (creates default if none)
 * PUT /api/agent/settings - Update agent settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

// ============================================
// GET /api/agent/settings
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'agent-settings' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    // Try to fetch existing settings
    const { data: existingSettings, error: fetchError } = await supabase
      .from('agent_settings')
      .select('*')
      .eq('organization_id', orgId)
      .single();

    let settings = existingSettings;

    // If no settings exist, create defaults
    if (fetchError?.code === 'PGRST116' || !settings) {
      const { data: newSettings, error: insertError } = await supabase
        .from('agent_settings')
        .insert({ organization_id: orgId })
        .select()
        .single();

      if (insertError) throw insertError;
      settings = newSettings;
    } else if (fetchError) {
      throw fetchError;
    }

    return NextResponse.json({ settings });
  }
);

// ============================================
// PUT /api/agent/settings
// ============================================

export const PUT = withApiHandler({ permission: 'write', resource: 'agent-settings' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    // Validate inputs
    const updates: Record<string, unknown> = {};

    if (body.agent_name !== undefined) {
      const name = String(body.agent_name).trim();
      if (name.length === 0 || name.length > 50) {
        return NextResponse.json(
          { error: 'Agent name must be 1-50 characters' },
          { status: 400 }
        );
      }
      updates.agent_name = name;
    }

    if (body.agent_focus !== undefined) {
      updates.agent_focus = body.agent_focus ? String(body.agent_focus).slice(0, 2000) : null;
    }

    if (body.heartbeat_enabled !== undefined) {
      updates.heartbeat_enabled = !!body.heartbeat_enabled;
    }

    if (body.heartbeat_time !== undefined) {
      // Validate time format HH:MM
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(body.heartbeat_time)) {
        return NextResponse.json(
          { error: 'Invalid heartbeat time format. Use HH:MM (24-hour)' },
          { status: 400 }
        );
      }
      updates.heartbeat_time = body.heartbeat_time;
    }

    if (body.notification_channel !== undefined) {
      const validChannels = ['in_app', 'slack', 'email'];
      if (!validChannels.includes(body.notification_channel)) {
        return NextResponse.json(
          { error: `Invalid notification channel. Must be one of: ${validChannels.join(', ')}` },
          { status: 400 }
        );
      }
      updates.notification_channel = body.notification_channel;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Upsert the settings
    const { data: settings, error } = await supabase
      .from('agent_settings')
      .upsert(
        { organization_id: orgId, ...updates },
        { onConflict: 'organization_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ settings });
  }
);
