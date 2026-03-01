/**
 * Slack Event Handlers
 *
 * Processes incoming Slack events (app_mention, message.im).
 * Routes messages through the agent chat pipeline.
 */

import { createClient } from '@/lib/supabase/server';
import { postMessage } from './client';

interface SlackEvent {
  type: string;
  user: string;
  text: string;
  channel: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
}

interface SlackEventPayload {
  type: string;
  token: string;
  team_id: string;
  event: SlackEvent;
  challenge?: string;
}

/**
 * Handle a verified Slack event payload.
 */
export async function handleSlackEvent(payload: SlackEventPayload): Promise<void> {
  // Ignore bot messages to prevent loops
  if (payload.event.bot_id) return;

  const supabase = await createClient();

  // Look up the integration by team_id to get org context
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, organization_id, credentials')
    .eq('type', 'slack')
    .eq('status', 'active')
    .filter('credentials->>team_id', 'eq', payload.team_id)
    .single();

  if (!integration) {
    console.error(`No active Slack integration for team ${payload.team_id}`);
    return;
  }

  const creds = integration.credentials as { bot_token: string; bot_user_id: string };
  const orgId = integration.organization_id;

  // Strip the bot mention from the text (for app_mention events)
  let messageText = payload.event.text;
  if (payload.event.type === 'app_mention') {
    messageText = messageText.replace(/<@[A-Z0-9]+>/g, '').trim();
  }

  if (!messageText) return;

  try {
    // Call the agent chat API internally
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const agentResponse = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': orgId,
        'x-auth-type': 'api_key',
        'x-auth-agent-name': 'slack-bot',
        'x-auth-permissions': 'read,write',
      },
      body: JSON.stringify({
        message: messageText,
      }),
    });

    if (!agentResponse.ok) {
      throw new Error(`Agent chat failed: ${agentResponse.status}`);
    }

    // Parse the SSE response to extract the final text
    const responseText = await agentResponse.text();
    const finalContent = extractFinalContent(responseText);

    if (finalContent) {
      await postMessage(creds.bot_token, payload.event.channel, finalContent, {
        thread_ts: payload.event.thread_ts || payload.event.ts,
      });
    }
  } catch (err) {
    console.error('Slack event handler error:', err);
    // Send error message back to Slack
    try {
      await postMessage(
        creds.bot_token,
        payload.event.channel,
        "Sorry, I ran into an error processing your request. Please try again.",
        { thread_ts: payload.event.thread_ts || payload.event.ts }
      );
    } catch {
      // Swallow error notification failures
    }
  }
}

/**
 * Extract the final text content from an SSE response stream.
 */
function extractFinalContent(sseText: string): string {
  const lines = sseText.split('\n');
  let content = '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'text' && data.content) {
          content += data.content;
        } else if (data.type === 'done' && data.content) {
          content = data.content;
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  return content;
}
