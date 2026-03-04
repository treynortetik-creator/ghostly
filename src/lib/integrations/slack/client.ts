/**
 * Slack Web API Client
 *
 * Thin wrapper around Slack's REST API using raw fetch.
 * Consistent with the codebase pattern (see openrouter.ts).
 */

const SLACK_API_BASE = 'https://slack.com/api';

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * Call a Slack Web API method.
 */
async function slackApi(
  method: string,
  token: string,
  params?: Record<string, unknown>
): Promise<SlackApiResponse> {
  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: params ? JSON.stringify(params) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as SlackApiResponse;
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'unknown'}`);
  }

  return data;
}

// ─── Public API Methods ─────────────────────────────────────────────────────

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members: number;
}

/**
 * List channels in a workspace. Supports cursor-based pagination.
 */
export async function listChannels(
  token: string,
  options?: { limit?: number; cursor?: string; query?: string }
): Promise<{ channels: SlackChannel[]; next_cursor?: string }> {
  const params: Record<string, unknown> = {
    types: 'public_channel,private_channel',
    exclude_archived: true,
    limit: options?.limit || 100,
  };
  if (options?.cursor) params.cursor = options.cursor;

  const data = await slackApi('conversations.list', token, params);
  let channels = ((data.channels as SlackChannel[]) || []).map((ch) => ({
    id: ch.id,
    name: ch.name,
    is_private: ch.is_private,
    num_members: ch.num_members,
  }));

  // Client-side filter if query provided
  if (options?.query) {
    const q = options.query.toLowerCase();
    channels = channels.filter((ch) => ch.name.toLowerCase().includes(q));
  }

  const metadata = data.response_metadata as { next_cursor?: string } | undefined;
  return {
    channels,
    next_cursor: metadata?.next_cursor || undefined,
  };
}

/**
 * Send a message to a channel or DM.
 */
export async function postMessage(
  token: string,
  channel: string,
  text: string,
  options?: { thread_ts?: string; blocks?: unknown[] }
): Promise<{ ts: string; channel: string }> {
  const params: Record<string, unknown> = { channel, text };
  if (options?.thread_ts) params.thread_ts = options.thread_ts;
  if (options?.blocks) params.blocks = options.blocks;

  const data = await slackApi('chat.postMessage', token, params);
  return { ts: data.ts as string, channel: data.channel as string };
}

/**
 * Open a DM conversation with a user.
 */
export async function openDM(
  token: string,
  userId: string
): Promise<string> {
  const data = await slackApi('conversations.open', token, { users: userId });
  const channel = data.channel as { id: string };
  return channel.id;
}

/**
 * Upload a file to a channel using files.uploadV2 flow.
 */
export async function uploadFile(
  token: string,
  channel: string,
  filename: string,
  content: Buffer | string,
  options?: { title?: string; initial_comment?: string }
): Promise<void> {
  const contentBuffer = typeof content === 'string' ? Buffer.from(content) : content;

  // Step 1: Get upload URL
  const getUrlData = await slackApi('files.getUploadURLExternal', token, {
    filename,
    length: contentBuffer.length,
  });

  const uploadUrl = getUrlData.upload_url as string;
  const fileId = getUrlData.file_id as string;

  // Step 2: Upload file content
  await fetch(uploadUrl, {
    method: 'POST',
    body: new Uint8Array(contentBuffer),
  });

  // Step 3: Complete upload and share to channel
  await slackApi('files.completeUploadExternal', token, {
    files: [{ id: fileId, title: options?.title || filename }],
    channel_id: channel,
    initial_comment: options?.initial_comment || '',
  });
}

/**
 * Schedule a message to be sent at a specific time.
 */
export async function scheduleMessage(
  token: string,
  channel: string,
  text: string,
  postAt: number
): Promise<string> {
  const data = await slackApi('chat.scheduleMessage', token, {
    channel,
    text,
    post_at: postAt,
  });
  return data.scheduled_message_id as string;
}

/**
 * Exchange an OAuth code for tokens.
 */
export async function exchangeOAuthCode(
  code: string,
  redirectUri: string
): Promise<{
  bot_token: string;
  bot_user_id: string;
  team_id: string;
  team_name: string;
  authed_user_id: string;
  scope: string;
}> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('SLACK_CLIENT_ID and SLACK_CLIENT_SECRET must be configured');
  }

  const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = (await response.json()) as SlackApiResponse;
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || 'unknown'}`);
  }

  const team = data.team as { id: string; name: string };
  const authedUser = data.authed_user as { id: string };

  return {
    bot_token: data.access_token as string,
    bot_user_id: data.bot_user_id as string,
    team_id: team.id,
    team_name: team.name,
    authed_user_id: authedUser.id,
    scope: data.scope as string,
  };
}

/**
 * Get the bot token for an org's Slack integration from the database.
 */
export async function getSlackBotToken(orgId: string): Promise<string | null> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = createClient();

  const { data } = await supabase
    .from('integrations')
    .select('credentials')
    .eq('organization_id', orgId)
    .eq('type', 'slack')
    .eq('status', 'active')
    .single();

  if (!data?.credentials) return null;
  const creds = data.credentials as { bot_token?: string };
  return creds.bot_token || null;
}
