/**
 * Email Notification Routing
 *
 * Routes Ghostly notifications to email recipients when configured.
 */

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from './client';

interface EmailCredentials {
  api_key?: string;
  from_email?: string;
  from_name?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Route a notification to email if configured.
 * Fire-and-forget — errors are logged but don't block notification creation.
 */
export async function routeNotificationToEmail(
  orgId: string,
  notificationType: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createClient();

  const { data: integration } = await supabase
    .from('integrations')
    .select('id, credentials')
    .eq('organization_id', orgId)
    .eq('type', 'email')
    .eq('status', 'active')
    .single();

  if (!integration) return;

  const { data: route } = await supabase
    .from('integration_notification_routes')
    .select('destination, is_enabled')
    .eq('integration_id', integration.id)
    .eq('notification_type', notificationType)
    .single();

  if (!route || !route.is_enabled || !route.destination) return;

  const creds = integration.credentials as EmailCredentials;
  const apiKey = creds.api_key || process.env.RESEND_API_KEY;
  const fromEmail = creds.from_email;
  const fromName = creds.from_name || 'Ghostly';

  if (!apiKey || !fromEmail) return;

  const recipients = route.destination
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (recipients.length === 0) return;

  const metadataText = metadata ? `\n\nMetadata:\n${JSON.stringify(metadata, null, 2)}` : '';
  const bodyText = `${message}${metadataText}`;
  const bodyHtml = `
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>
    ${metadata ? `<pre>${escapeHtml(JSON.stringify(metadata, null, 2))}</pre>` : ''}
  `;

  try {
    await sendEmail(
      apiKey,
      recipients,
      title,
      bodyHtml,
      bodyText,
      fromEmail,
      fromName
    );
  } catch (err) {
    console.error(`Failed to route notification to email: ${err}`);
  }
}
