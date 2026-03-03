/**
 * Ghostly Agent - Settings API
 *
 * GET /api/agent/settings - Get agent settings for current org (creates default if none)
 * PUT /api/agent/settings - Update agent settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import type { ToolPermissionMode } from '@/lib/agent/tools';

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

    if (body.system_prompt_template !== undefined) {
      const template = body.system_prompt_template ? String(body.system_prompt_template) : '';
      if (template.length > 12000) {
        return NextResponse.json(
          { error: 'system_prompt_template must be 12000 characters or fewer' },
          { status: 400 }
        );
      }
      updates.system_prompt_template = template.trim() ? template : null;
    }

    if (body.autonomy_mode !== undefined) {
      const mode = String(body.autonomy_mode);
      if (!['safe', 'full'].includes(mode)) {
        return NextResponse.json(
          { error: 'autonomy_mode must be one of: safe, full' },
          { status: 400 }
        );
      }
      updates.autonomy_mode = mode;
    }

    if (body.default_model !== undefined) {
      const model = body.default_model ? String(body.default_model).trim() : '';
      if (model.length > 200) {
        return NextResponse.json(
          { error: 'default_model must be 200 characters or fewer' },
          { status: 400 }
        );
      }
      updates.default_model = model || null;
    }

    if (body.model_routing !== undefined) {
      if (!body.model_routing || typeof body.model_routing !== 'object' || Array.isArray(body.model_routing)) {
        return NextResponse.json(
          { error: 'model_routing must be an object' },
          { status: 400 }
        );
      }
      updates.model_routing = body.model_routing as Record<string, unknown>;
    }

    if (body.tool_permissions !== undefined) {
      if (
        !body.tool_permissions ||
        typeof body.tool_permissions !== 'object' ||
        Array.isArray(body.tool_permissions)
      ) {
        return NextResponse.json(
          { error: 'tool_permissions must be an object keyed by tool name' },
          { status: 400 }
        );
      }

      const validModes: ToolPermissionMode[] = ['never', 'ask', 'always'];
      const cleaned: Record<string, ToolPermissionMode> = {};

      for (const [toolName, mode] of Object.entries(body.tool_permissions as Record<string, unknown>)) {
        if (typeof mode !== 'string' || !validModes.includes(mode as ToolPermissionMode)) {
          return NextResponse.json(
            { error: `Invalid permission mode for ${toolName}. Must be one of: ${validModes.join(', ')}` },
            { status: 400 }
          );
        }
        cleaned[toolName] = mode as ToolPermissionMode;
      }

      updates.tool_permissions = cleaned;
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
