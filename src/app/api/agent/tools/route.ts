/**
 * Ghostly Agent - Tools Metadata API
 *
 * GET /api/agent/tools - List tools with descriptions and current permission mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import {
  agentTools,
  getAllTools,
  getToolDefaultPermission,
  getToolPermissionMode,
} from '@/lib/agent/tools';
import { ensureIntegrationsRegistered, getIntegrationTools } from '@/lib/integrations/registry';

export const GET = withApiHandler({ permission: 'read', resource: 'agent-settings' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { data: settings } = await supabase
      .from('agent_settings')
      .select('tool_permissions')
      .eq('organization_id', orgId)
      .single();

    await ensureIntegrationsRegistered();
    const integrationTools = await getIntegrationTools(orgId);

    const coreToolNames = new Set(agentTools.map((tool) => tool.name));
    const tools = getAllTools(integrationTools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      source: coreToolNames.has(tool.name) ? 'core' : 'integration',
      default_permission: getToolDefaultPermission(tool),
      permission_mode: getToolPermissionMode(
        tool.name,
        (settings?.tool_permissions as Record<string, unknown> | null | undefined) ?? {},
        integrationTools
      ),
    }));

    return NextResponse.json({ tools });
  }
);
