/**
 * Email Integration Module
 *
 * Registers the Email integration with the plugin registry.
 */

import type { IntegrationModule } from '@/lib/integrations/types';
import { registerIntegration } from '@/lib/integrations/registry';
import { buildEmailTools } from './tools';

const emailIntegration: IntegrationModule = {
  config: {
    id: 'email',
    name: 'Email',
    description: 'Send event updates vendor confirmations and attendee notifications via email.',
    icon: 'Mail',
  },

  getTools(orgId: string, integrationId: string) {
    return buildEmailTools(orgId, integrationId);
  },
};

registerIntegration(emailIntegration);

export default emailIntegration;
