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

    if (body.heartbeat_interval !== undefined) {
      const interval = Number(body.heartbeat_interval);
      if (!Number.isInteger(interval) || interval < 15 || interval > 1440) {
        return NextResponse.json(
          { error: 'Heartbeat interval must be between 15 and 1440 minutes' },
          { status: 400 }
        );
      }
      updates.heartbeat_interval = interval;
    }

    if (body.heartbeat_prompt !== undefined) {
      const prompt = String(body.heartbeat_prompt).trim();
      if (prompt.length === 0 || prompt.length > 2000) {
        return NextResponse.json(
          { error: 'Heartbeat prompt must be 1-2000 characters' },
          { status: 400 }
        );
      }
      updates.heartbeat_prompt = prompt;
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
