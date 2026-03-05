/**
 * Email Agent Tools
 *
 * Tools the agent can use when Email is connected.
 */

import type { AgentTool } from '@/lib/agent/tools';
import { getEmailCredentials, sendEmail } from './client';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/utils';

function toHtml(body: string): string {
  return body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br />');
}

/**
 * Build the Email agent tools for a specific org/integration.
 */
export function buildEmailTools(orgId: string, integrationId: string): AgentTool[] {
  return [
    {
      name: 'send_email',
      description: 'Send an email to one or more recipients using the connected email integration.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address. Multiple recipients can be comma-separated.',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          body: {
            type: 'string',
            description: 'Plain-text email body content',
          },
          event_id: {
            type: 'string',
            description: 'Optional event ID to include event context in the subject',
          },
        },
        required: ['to', 'subject', 'body'],
      },
      execute: async (args) => {
        const creds = await getEmailCredentials(orgId);
        if (!creds?.api_key || !creds.from_email) {
          return JSON.stringify({ error: 'Email not connected' });
        }

        try {
          let subject = args.subject as string;
          const eventId = args.event_id as string | undefined;

          if (eventId) {
            const supabase = createClient();
            const { data: event } = await supabase
              .from('events')
              .select('name')
              .eq('id', eventId)
              .eq('organization_id', orgId)
              .single();

            if (event?.name) {
              subject = `[${event.name}] ${subject}`;
            }
          }

          const result = await sendEmail(
            creds.api_key,
            args.to as string,
            subject,
            toHtml(args.body as string),
            args.body as string,
            creds.from_email,
            creds.from_name || 'Ghostly'
          );

          return JSON.stringify({ success: true, id: result.id, to: args.to, subject });
        } catch (err) {
          return JSON.stringify({ error: getErrorMessage(err) });
        }
      },
    },

    {
      name: 'draft_email',
      description: 'Draft an email message without sending it.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address',
          },
          subject: {
            type: 'string',
            description: 'Email subject line',
          },
          context: {
            type: 'string',
            description: 'Context and goals for the draft email',
          },
        },
        required: ['to', 'subject', 'context'],
      },
      execute: async (args) => {
        const recipient = args.to as string;
        const subject = args.subject as string;
        const context = args.context as string;
        const senderName = (await getEmailCredentials(orgId))?.from_name || 'Ghostly Team';

        const draft = [
          `To: ${recipient}`,
          `Subject: ${subject}`,
          '',
          `Hi ${recipient.split('@')[0]},`,
          '',
          context,
          '',
          'Please let me know if you have any questions.',
          '',
          `Best,`,
          senderName,
        ].join('\n');

        return JSON.stringify({ success: true, draft, integration_id: integrationId });
      },
    },
  ];
}
