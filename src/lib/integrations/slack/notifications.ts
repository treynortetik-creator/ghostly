/**
 * Slack Notification Routing
 *
 * When a notification is created in Ghostly, check if there's a Slack
 * routing rule and forward it to the appropriate channel/DM.
 */

import { createClient } from '@/lib/supabase/server';
import { postMessage, openDM } from './client';

/**
 * Route a notification to Slack if configured.
 * Fire-and-forget — errors are logged but don't block notification creation.
 */
export async function routeNotificationToSlack(
  orgId: string,
  notificationType: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createClient();

  // Check if there's a Slack integration and a routing rule for this type
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, credentials')
    .eq('organization_id', orgId)
    .eq('type', 'slack')
    .eq('status', 'active')
    .single();

  if (!integration) return;

  const { data: route } = await supabase
    .from('integration_notification_routes')
    .select('destination, is_enabled')
    .eq('integration_id', integration.id)
    .eq('notification_type', notificationType)
    .single();

  if (!route || !route.is_enabled) return;

  const creds = integration.credentials as { bot_token: string; installed_by: string };
  if (!creds.bot_token) return;

  try {
    let channelId = route.destination;

    // If destination is 'dm', open a DM with the installing user
    if (channelId === 'dm') {
      channelId = await openDM(creds.bot_token, creds.installed_by);
    }

    // Also check if there's an event-specific channel
    if (metadata?.event_id) {
      const { data: eventChannel } = await supabase
        .from('integration_event_channels')
        .select('slack_channel_id')
        .eq('integration_id', integration.id)
        .eq('event_id', metadata.event_id as string)
        .single();

      if (eventChannel) {
        channelId = eventChannel.slack_channel_id;
      }
    }

    const typeEmoji: Record<string, string> = {
      budget_alert: ':warning:',
      task_reminder: ':bell:',
      agent_message: ':robot_face:',
      custom_reminder: ':clock3:',
    };

    const emoji = typeEmoji[notificationType] || ':bell:';
    const slackMessage = `${emoji} *${title}*\n${message}`;

    await postMessage(creds.bot_token, channelId, slackMessage);
  } catch (err) {
    console.error(`Failed to route notification to Slack: ${err}`);
  }
}
