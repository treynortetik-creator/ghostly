/**
 * Slack Digest Generator
 *
 * Generates daily/weekly summary digests using the agent
 * and delivers them via Slack DM.
 */

import { createClient } from '@/lib/supabase/server';
import { postMessage, openDM } from './client';

/**
 * Generate and send a digest for a specific org.
 */
export async function generateAndSendDigest(
  orgId: string,
  digestType: 'daily' | 'weekly'
): Promise<void> {
  const supabase = await createClient();

  // Get integration credentials
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, credentials')
    .eq('organization_id', orgId)
    .eq('type', 'slack')
    .eq('status', 'active')
    .single();

  if (!integration) return;

  const creds = integration.credentials as {
    bot_token: string;
    installed_by: string;
  };

  // Build the digest prompt
  const prompt = digestType === 'daily'
    ? 'Generate a concise daily briefing. Include: events happening today or tomorrow, overdue checklist items, any budget alerts (events over 90% of budget), and today\'s reminders. Format for Slack with emoji and bold text.'
    : 'Generate a weekly summary. Include: events this week, budget overview across all active events (spent vs budget), checklist completion rates, key milestones coming up this week, and any items needing attention. Format for Slack with emoji and bold text.';

  try {
    // Call the agent to generate the digest
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const agentResponse = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': orgId,
        'x-auth-type': 'api_key',
        'x-auth-agent-name': 'slack-digest',
        'x-auth-permissions': 'read,write',
      },
      body: JSON.stringify({ message: prompt }),
    });

    if (!agentResponse.ok) {
      throw new Error(`Agent chat failed: ${agentResponse.status}`);
    }

    // Parse SSE response
    const responseText = await agentResponse.text();
    const lines = responseText.split('\n');
    let content = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text' && data.content) content += data.content;
          else if (data.type === 'done' && data.content) content = data.content;
        } catch {
          // Skip
        }
      }
    }

    if (!content) return;

    // Send as DM to the installing user
    const dmChannel = await openDM(creds.bot_token, creds.installed_by);
    const header = digestType === 'daily' ? ':sunrise: *Daily Briefing*' : ':calendar: *Weekly Summary*';
    await postMessage(creds.bot_token, dmChannel, `${header}\n\n${content}`);
  } catch (err) {
    console.error(`Digest generation failed for org ${orgId}:`, err);
  }
}

/**
 * Check and send digests for all orgs that have them configured.
 * Called by a cron endpoint.
 */
export async function processDigests(digestType: 'daily' | 'weekly'): Promise<number> {
  const supabase = await createClient();

  const { data: configs } = await supabase
    .from('integration_digest_config')
    .select('organization_id')
    .eq('digest_type', digestType)
    .eq('is_enabled', true);

  if (!configs || configs.length === 0) return 0;

  let sent = 0;
  for (const config of configs) {
    try {
      await generateAndSendDigest(config.organization_id, digestType);
      sent++;
    } catch (err) {
      console.error(`Digest failed for org ${config.organization_id}:`, err);
    }
  }

  return sent;
}
