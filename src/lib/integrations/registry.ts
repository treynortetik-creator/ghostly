/**
 * Ghostly Integration Registry
 *
 * Central registry for all integration modules. The agent system calls
 * getIntegrationTools() to dynamically load tools from connected integrations.
 */

import type { IntegrationModule } from './types';
import type { AgentTool } from '@/lib/agent/tools';
import { createClient } from '@/lib/supabase/server';

const registeredIntegrations = new Map<string, IntegrationModule>();

/**
 * Register an integration module. Called at import time by each integration.
 */
export function registerIntegration(plugin: IntegrationModule): void {
  registeredIntegrations.set(plugin.config.id, plugin);
}

/**
 * Get a registered integration module by type.
 */
export function getIntegrationModule(type: string): IntegrationModule | undefined {
  return registeredIntegrations.get(type);
}

/**
 * Get all registered integration configs (for UI listing).
 */
export function getRegisteredIntegrations(): IntegrationModule['config'][] {
  return Array.from(registeredIntegrations.values()).map((m) => m.config);
}

/**
 * Load agent tools from all connected integrations for an org.
 * Called by the agent chat endpoint to dynamically extend the tool set.
 */
export async function getIntegrationTools(orgId: string): Promise<AgentTool[]> {
  const supabase = createClient();

  const { data: integrations } = await supabase
    .from('integrations')
    .select('id, type')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (!integrations || integrations.length === 0) return [];

  const tools: AgentTool[] = [];

  for (const integration of integrations) {
    const plugin = registeredIntegrations.get(integration.type);
    if (plugin) {
      tools.push(...plugin.getTools(orgId, integration.id));
    }
  }

  return tools;
}

/**
 * Ensure all integration modules are registered.
 * Call this once before using getIntegrationTools().
 */
export async function ensureIntegrationsRegistered(): Promise<void> {
  if (!registeredIntegrations.has('slack')) {
    await import('./slack/index');
  }
  if (!registeredIntegrations.has('email')) {
    await import('./email/index');
  }
}
