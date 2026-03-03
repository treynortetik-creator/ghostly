/**
 * Slack Event Handlers
 *
 * Processes incoming Slack events (app_mention, message.im).
 * Routes messages through the shared agent runtime.
 */

import { createClient } from '@/lib/supabase/server';
import { postMessage } from './client';
import { runAgentTask } from '@/lib/agent/runtime';

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

  const threadRoot = payload.event.thread_ts || payload.event.ts;
  const sessionKey = `Slack :: ${payload.team_id}:${payload.event.channel}:${threadRoot}`;

  try {
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('organization_id', orgId)
      .eq('title', sessionKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const result = await runAgentTask({
      orgId,
      source: 'slack',
      prompt: messageText,
      sessionId: existingSession?.id,
      sessionTitle: sessionKey,
      allowAskTools: false,
      allowWriteTools: false,
    });

    if (result.content) {
      await postMessage(creds.bot_token, payload.event.channel, result.content, {
        thread_ts: threadRoot,
      });
    }
  } catch (err) {
    console.error('Slack event handler error:', err);
    // Send error message back to Slack
    try {
      await postMessage(
        creds.bot_token,
        payload.event.channel,
        'Sorry, I ran into an error processing your request. Please try again.',
        { thread_ts: threadRoot }
      );
    } catch {
      // Swallow error notification failures
    }
  }
}
