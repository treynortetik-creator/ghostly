/**
 * Email Client (Resend)
 *
 * Thin wrapper around Resend for sending transactional emails.
 */

import { Resend } from 'resend';

interface EmailCredentials {
  api_key?: string;
  from_email?: string;
  from_name?: string;
}

/**
 * Send an email through Resend.
 */
export async function sendEmail(
  apiKey: string,
  to: string | string[],
  subject: string,
  bodyHtml: string,
  bodyText: string,
  fromEmail: string,
  fromName: string
): Promise<{ id: string | null }> {
  const resend = new Resend(apiKey);
  const recipients = Array.isArray(to)
    ? to
    : to.split(',').map((value) => value.trim()).filter(Boolean);

  if (recipients.length === 0) {
    throw new Error('No recipient email provided');
  }

  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const { data, error } = await resend.emails.send({
    from,
    to: recipients,
    subject,
    html: bodyHtml,
    text: bodyText,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send email');
  }

  return { id: data?.id || null };
}

/**
 * Get active email integration credentials for an organization.
 */
export async function getEmailCredentials(orgId: string): Promise<EmailCredentials | null> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = createClient();

  const { data } = await supabase
    .from('integrations')
    .select('credentials')
    .eq('organization_id', orgId)
    .eq('type', 'email')
    .eq('status', 'active')
    .single();

  if (!data?.credentials) return null;

  const creds = data.credentials as EmailCredentials;
  const apiKey = creds.api_key || process.env.RESEND_API_KEY;

  if (!apiKey) return null;

  return {
    ...creds,
    api_key: apiKey,
  };
}
