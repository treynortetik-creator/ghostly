/**
 * Slack Integration Module
 *
 * Registers the Slack integration with the plugin registry.
 */

import type { IntegrationModule } from '@/lib/integrations/types';
import { registerIntegration } from '@/lib/integrations/registry';
import { buildSlackTools } from './tools';

const slackIntegration: IntegrationModule = {
  config: {
    id: 'slack',
    name: 'Slack',
    description: 'Connect Slack to receive notifications, send messages, and interact with the agent via slash commands and DMs.',
    icon: 'MessageSquare',
  },

  getTools(orgId: string, integrationId: string) {
    return buildSlackTools(orgId, integrationId);
  },
};

registerIntegration(slackIntegration);

export default slackIntegration;
