/**
 * Ghostly Integration System - Type Definitions
 *
 * Each integration (Slack, future Google Calendar, etc.) implements this
 * interface. The registry loads tools dynamically based on which
 * integrations an org has connected.
 */

import type { AgentTool } from '@/lib/agent/tools';

export interface IntegrationConfig {
  /** Unique identifier for this integration type (e.g. 'slack') */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon name from lucide-react */
  icon: string;
}

export interface IntegrationModule {
  /** Static config for this integration */
  config: IntegrationConfig;

  /**
   * Return the agent tools this integration provides.
   * Called at runtime — only tools from connected integrations are loaded.
   * @param orgId - Organization ID for scoping API calls
   * @param integrationId - The specific integration record ID
   */
  getTools(orgId: string, integrationId: string): AgentTool[];
}
