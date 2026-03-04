/**
 * Slack Agent Tools
 *
 * Tools the agent can use when Slack is connected.
 * These are dynamically loaded via the integration registry.
 */

import type { AgentTool } from '@/lib/agent/tools';
import { listChannels, postMessage, uploadFile, getSlackBotToken } from './client';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/utils';

/**
 * Build the Slack agent tools for a specific org/integration.
 */
export function buildSlackTools(orgId: string, integrationId: string): AgentTool[] {
  return [
    {
      name: 'slack_list_channels',
      description: 'List or search Slack channels in the connected workspace. Use to find channels by name.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional search query to filter channels by name',
          },
        },
      },
      execute: async (args) => {
        const token = await getSlackBotToken(orgId);
        if (!token) return JSON.stringify({ error: 'Slack not connected' });

        try {
          const result = await listChannels(token, {
            query: args.query as string | undefined,
            limit: 50,
          });
          return JSON.stringify({
            channels: result.channels.map((ch) => ({
              id: ch.id,
              name: `#${ch.name}`,
              is_private: ch.is_private,
              members: ch.num_members,
            })),
          });
        } catch (err) {
          return JSON.stringify({ error: getErrorMessage(err) });
        }
      },
    },

    {
      name: 'slack_send_message',
      description: 'Send a message to a Slack channel. Use channel ID (from slack_list_channels) or a linked event channel.',
      parameters: {
        type: 'object',
        properties: {
          channel_id: {
            type: 'string',
            description: 'Slack channel ID to send the message to',
          },
          event_id: {
            type: 'string',
            description: 'Event ID — if provided, sends to the linked Slack channel for this event (instead of channel_id)',
          },
          message: {
            type: 'string',
            description: 'The message text to send (supports Slack markdown)',
          },
          thread_ts: {
            type: 'string',
            description: 'Optional thread timestamp to reply in a thread',
          },
        },
        required: ['message'],
      },
      execute: async (args) => {
        const token = await getSlackBotToken(orgId);
        if (!token) return JSON.stringify({ error: 'Slack not connected' });

        let channelId = args.channel_id as string | undefined;

        // If event_id provided, look up the linked channel
        if (!channelId && args.event_id) {
          const supabase = createClient();
          const { data } = await supabase
            .from('integration_event_channels')
            .select('slack_channel_id')
            .eq('integration_id', integrationId)
            .eq('event_id', args.event_id as string)
            .single();

          if (data) channelId = data.slack_channel_id;
        }

        if (!channelId) {
          return JSON.stringify({ error: 'No channel specified. Provide channel_id or an event_id with a linked Slack channel.' });
        }

        try {
          const result = await postMessage(token, channelId, args.message as string, {
            thread_ts: args.thread_ts as string | undefined,
          });
          return JSON.stringify({ success: true, channel: result.channel, ts: result.ts });
        } catch (err) {
          return JSON.stringify({ error: getErrorMessage(err) });
        }
      },
    },

    {
      name: 'slack_send_document',
      description: 'Upload and send a Ghostly document to a Slack channel as a file attachment.',
      parameters: {
        type: 'object',
        properties: {
          document_id: {
            type: 'string',
            description: 'Ghostly document ID to send',
          },
          channel_id: {
            type: 'string',
            description: 'Slack channel ID to send the document to',
          },
          event_id: {
            type: 'string',
            description: 'Event ID — if provided, sends to the linked Slack channel for this event',
          },
          comment: {
            type: 'string',
            description: 'Optional message to include with the file',
          },
        },
        required: ['document_id'],
      },
      execute: async (args) => {
        const token = await getSlackBotToken(orgId);
        if (!token) return JSON.stringify({ error: 'Slack not connected' });

        let channelId = args.channel_id as string | undefined;

        if (!channelId && args.event_id) {
          const supabase = createClient();
          const { data } = await supabase
            .from('integration_event_channels')
            .select('slack_channel_id')
            .eq('integration_id', integrationId)
            .eq('event_id', args.event_id as string)
            .single();

          if (data) channelId = data.slack_channel_id;
        }

        if (!channelId) {
          return JSON.stringify({ error: 'No channel specified. Provide channel_id or an event_id with a linked Slack channel.' });
        }

        // Fetch the document metadata
        const supabase = createClient();
        const { data: doc } = await supabase
          .from('documents')
          .select('filename, original_filename, storage_path, mime_type')
          .eq('id', args.document_id as string)
          .eq('organization_id', orgId)
          .single();

        if (!doc) {
          return JSON.stringify({ error: 'Document not found' });
        }

        try {
          const fs = await import('fs/promises');
          const content = await fs.readFile(doc.storage_path);

          await uploadFile(token, channelId, doc.original_filename || doc.filename, content, {
            title: doc.original_filename || doc.filename,
            initial_comment: (args.comment as string) || '',
          });

          return JSON.stringify({ success: true, filename: doc.original_filename || doc.filename });
        } catch (err) {
          return JSON.stringify({ error: getErrorMessage(err) });
        }
      },
    },

    {
      name: 'slack_link_event_channel',
      description: 'Link a Ghostly event to a Slack channel. Notifications and documents for this event will be sent to the linked channel.',
      parameters: {
        type: 'object',
        properties: {
          event_id: {
            type: 'string',
            description: 'Ghostly event ID to link',
          },
          channel_id: {
            type: 'string',
            description: 'Slack channel ID to link to',
          },
          channel_name: {
            type: 'string',
            description: 'Slack channel name (for display purposes)',
          },
        },
        required: ['event_id', 'channel_id'],
      },
      execute: async (args) => {
        const supabase = createClient();

        // Verify the event exists and belongs to this org
        const { data: event } = await supabase
          .from('events')
          .select('id, name')
          .eq('id', args.event_id as string)
          .eq('organization_id', orgId)
          .single();

        if (!event) {
          return JSON.stringify({ error: 'Event not found' });
        }

        const { error } = await supabase
          .from('integration_event_channels')
          .upsert(
            {
              organization_id: orgId,
              integration_id: integrationId,
              event_id: args.event_id as string,
              slack_channel_id: args.channel_id as string,
              slack_channel_name: (args.channel_name as string) || '',
            },
            { onConflict: 'organization_id,integration_id,event_id' }
          );

        if (error) {
          return JSON.stringify({ error: error.message });
        }

        return JSON.stringify({
          success: true,
          event: event.name,
          channel: args.channel_name || args.channel_id,
        });
      },
    },
  ];
}
