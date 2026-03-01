# Slack Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Slack OAuth app integration with agent messaging, notification routing, slash commands, DM conversations, and scheduled digests via a modular plugin architecture.

**Architecture:** Plugin/integration registry system where each integration registers tools dynamically. Slack is the first plugin. Raw fetch for Slack API (no SDK). OAuth v2 flow with signed JWT state. Notification routing per type/event to Slack channels.

**Tech Stack:** Next.js 16 API routes, Supabase PostgreSQL, raw fetch for Slack Web API, crypto for HMAC verification, jose for OAuth state JWTs

**Design doc:** `docs/plans/2026-02-28-slack-integration-design.md`

---

### Task 1: Database Migration

**Files:**
- Create via Supabase MCP: migration `030_integrations`
- Modify: `src/types/database.ts`

**Step 1: Apply migration**

Use the Supabase MCP `apply_migration` tool with name `030_integrations` and this SQL:

```sql
-- ============================================
-- 030: Integrations Infrastructure
-- ============================================

-- 1. Core integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('slack')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected')),
  credentials JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  installed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_integrations_org_type ON integrations(organization_id, type);
CREATE INDEX idx_integrations_org ON integrations(organization_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_integrations_updated_at();

-- 2. Notification routing rules
CREATE TABLE IF NOT EXISTS integration_notification_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT 'dm',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_notif_routes_unique
  ON integration_notification_routes(organization_id, integration_id, notification_type);
CREATE INDEX idx_notif_routes_org ON integration_notification_routes(organization_id);

-- 3. Event-to-channel mappings
CREATE TABLE IF NOT EXISTS integration_event_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slack_channel_id TEXT NOT NULL,
  slack_channel_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_event_channels_unique
  ON integration_event_channels(organization_id, integration_id, event_id);
CREATE INDEX idx_event_channels_event ON integration_event_channels(event_id);

-- 4. Digest configuration
CREATE TABLE IF NOT EXISTS integration_digest_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  digest_type TEXT NOT NULL CHECK (digest_type IN ('daily', 'weekly')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  send_time TIME NOT NULL DEFAULT '09:00:00',
  day_of_week INT DEFAULT 1 CHECK (day_of_week >= 0 AND day_of_week <= 6),
  recipient_type TEXT NOT NULL DEFAULT 'dm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_digest_config_unique
  ON integration_digest_config(organization_id, integration_id, digest_type);
```

**Step 2: Add TypeScript types to `src/types/database.ts`**

Add these interfaces near the other interface definitions (after the `AgentSettings` interface around line 795):

```typescript
// ─── Integration Types ──────────────────────────────────────────────────────

export interface Integration {
  id: string;
  organization_id: string;
  type: 'slack';
  status: 'active' | 'disconnected';
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  installed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationNotificationRoute {
  id: string;
  organization_id: string;
  integration_id: string;
  notification_type: string;
  destination: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationEventChannel {
  id: string;
  organization_id: string;
  integration_id: string;
  event_id: string;
  slack_channel_id: string;
  slack_channel_name: string;
  created_at: string;
}

export interface IntegrationDigestConfig {
  id: string;
  organization_id: string;
  integration_id: string;
  digest_type: 'daily' | 'weekly';
  is_enabled: boolean;
  send_time: string;
  day_of_week: number;
  recipient_type: string;
  created_at: string;
  updated_at: string;
}
```

Also add the table type definitions to the `Database['public']['Tables']` type (follow the existing pattern for Row/Insert/Update — see `app_settings` as reference).

**Step 3: Add env vars to `.env.example`**

Append to the end:

```env
# Slack Integration (OAuth App)
# Create at https://api.slack.com/apps
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
```

**Step 4: Commit**

```bash
git add supabase/migrations/ src/types/database.ts .env.example
git commit -m "feat: add integration tables migration and types"
```

---

### Task 2: Integration Registry System

**Files:**
- Create: `src/lib/integrations/types.ts`
- Create: `src/lib/integrations/registry.ts`

**Step 1: Create the integration interface at `src/lib/integrations/types.ts`**

```typescript
/**
 * Ghostly Integration System - Type Definitions
 *
 * Each integration (Slack, future Google Calendar, etc.) implements this
 * interface. The registry loads tools dynamically based on which
 * integrations an org has connected.
 */

import type { AgentTool } from '@/lib/agent/tools';

export interface IntegrationConfig {
  /** Unique identifier for this integration type (e.g. 'slack') */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon name from lucide-react */
  icon: string;
}

export interface IntegrationModule {
  /** Static config for this integration */
  config: IntegrationConfig;

  /**
   * Return the agent tools this integration provides.
   * Called at runtime — only tools from connected integrations are loaded.
   * @param orgId - Organization ID for scoping API calls
   * @param integrationId - The specific integration record ID
   */
  getTools(orgId: string, integrationId: string): AgentTool[];
}
```

**Step 2: Create the registry at `src/lib/integrations/registry.ts`**

```typescript
/**
 * Ghostly Integration Registry
 *
 * Central registry for all integration modules. The agent system calls
 * getIntegrationTools() to dynamically load tools from connected integrations.
 */

import type { IntegrationModule } from './types';
import type { AgentTool } from '@/lib/agent/tools';
import { createClient } from '@/lib/supabase/server';

const registeredIntegrations = new Map<string, IntegrationModule>();

/**
 * Register an integration module. Called at import time by each integration.
 */
export function registerIntegration(module: IntegrationModule): void {
  registeredIntegrations.set(module.config.id, module);
}

/**
 * Get a registered integration module by type.
 */
export function getIntegrationModule(type: string): IntegrationModule | undefined {
  return registeredIntegrations.get(type);
}

/**
 * Get all registered integration configs (for UI listing).
 */
export function getRegisteredIntegrations(): IntegrationModule['config'][] {
  return Array.from(registeredIntegrations.values()).map((m) => m.config);
}

/**
 * Load agent tools from all connected integrations for an org.
 * Called by the agent chat endpoint to dynamically extend the tool set.
 */
export async function getIntegrationTools(orgId: string): Promise<AgentTool[]> {
  const supabase = await createClient();

  const { data: integrations } = await supabase
    .from('integrations')
    .select('id, type')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (!integrations || integrations.length === 0) return [];

  const tools: AgentTool[] = [];

  for (const integration of integrations) {
    const module = registeredIntegrations.get(integration.type);
    if (module) {
      tools.push(...module.getTools(orgId, integration.id));
    }
  }

  return tools;
}
```

**Step 3: Commit**

```bash
git add src/lib/integrations/
git commit -m "feat: add integration registry system"
```

---

### Task 3: Dynamic Tool Loading in Agent

**Files:**
- Modify: `src/lib/agent/tools.ts` (lines 616-639)
- Modify: `src/app/api/agent/chat/route.ts` (lines 24, 332, 456, 524)

**Step 1: Update `src/lib/agent/tools.ts`**

Change `toolsToOpenRouterFormat` to accept extra tools (around line 616):

```typescript
/**
 * Convert agent tools to the OpenRouter function-calling format.
 * Accepts optional extra tools (from integrations) to include.
 */
export function toolsToOpenRouterFormat(extraTools?: AgentTool[]): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: AgentTool['parameters'];
  };
}> {
  const allTools = extraTools ? [...agentTools, ...extraTools] : agentTools;
  return allTools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Find a tool by name. Searches core tools first, then extra tools.
 */
export function findTool(name: string, extraTools?: AgentTool[]): AgentTool | undefined {
  const found = agentTools.find((t) => t.name === name);
  if (found) return found;
  if (extraTools) return extraTools.find((t) => t.name === name);
  return undefined;
}
```

**Step 2: Update `src/app/api/agent/chat/route.ts`**

Add import at the top (after existing imports around line 24):

```typescript
import { getIntegrationTools } from '@/lib/integrations/registry';
```

After the agent settings load (around line 312, after `const agentFocus = ...`), load integration tools:

```typescript
    // ─── Load integration tools ─────────────────────────────────────────
    const integrationTools = await getIntegrationTools(orgId);
```

Update the system prompt builder (around line 327) to include integration tools:

```typescript
    const systemPrompt = buildSystemPrompt({
      agentName,
      agentFocus,
      eventId: event_id,
      eventName,
      tools: [...agentTools, ...integrationTools],
    });
```

Update the OpenRouter tools conversion (around line 456):

```typescript
    const openRouterTools = toolsToOpenRouterFormat(integrationTools);
```

Update the findTool call in the tool execution loop (around line 524):

```typescript
          const tool = findTool(toolName, integrationTools);
```

**Step 3: Commit**

```bash
git add src/lib/agent/tools.ts src/app/api/agent/chat/route.ts
git commit -m "feat: dynamic tool loading from integration registry"
```

---

### Task 4: Slack Verification & Client

**Files:**
- Create: `src/lib/integrations/slack/verification.ts`
- Create: `src/lib/integrations/slack/client.ts`

**Step 1: Create `src/lib/integrations/slack/verification.ts`**

```typescript
/**
 * Slack Request Verification
 *
 * Verifies incoming requests from Slack using the signing secret.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */

import { createHmac, timingSafeEqual } from 'crypto';

const SLACK_VERSION = 'v0';
const MAX_TIMESTAMP_DIFF_SECONDS = 300; // 5 minutes

/**
 * Verify a Slack request signature.
 * Returns true if the request is authentic, false otherwise.
 */
export function verifySlackRequest(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Reject if timestamp is too old (replay attack prevention)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_DIFF_SECONDS) {
    return false;
  }

  // Compute expected signature
  const baseString = `${SLACK_VERSION}:${timestamp}:${body}`;
  const expectedSignature =
    `${SLACK_VERSION}=` +
    createHmac('sha256', signingSecret).update(baseString).digest('hex');

  // Constant-time comparison
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Extract and verify a Slack request from a NextRequest.
 * Returns the raw body string if verified, or null if verification fails.
 */
export async function verifySlackNextRequest(
  request: Request
): Promise<{ verified: boolean; body: string }> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET not configured');
    return { verified: false, body: '' };
  }

  const signature = request.headers.get('x-slack-signature') || '';
  const timestamp = request.headers.get('x-slack-request-timestamp') || '';
  const body = await request.text();

  const verified = verifySlackRequest(signingSecret, signature, timestamp, body);
  return { verified, body };
}
```

**Step 2: Create `src/lib/integrations/slack/client.ts`**

```typescript
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

  // Client-side filter if query provided (Slack API doesn't support server-side search on conversations.list)
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
 * Upload a file to a channel.
 * Uses files.uploadV2 which requires multipart form data.
 */
export async function uploadFile(
  token: string,
  channel: string,
  filename: string,
  content: Buffer | string,
  options?: { title?: string; initial_comment?: string }
): Promise<void> {
  // Step 1: Get upload URL
  const contentBuffer = typeof content === 'string' ? Buffer.from(content) : content;
  const getUrlData = await slackApi('files.getUploadURLExternal', token, {
    filename,
    length: contentBuffer.length,
  });

  const uploadUrl = getUrlData.upload_url as string;
  const fileId = getUrlData.file_id as string;

  // Step 2: Upload file content
  await fetch(uploadUrl, {
    method: 'POST',
    body: contentBuffer,
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
  // Dynamic import to avoid circular deps
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

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
```

**Step 3: Commit**

```bash
git add src/lib/integrations/slack/
git commit -m "feat: Slack verification and API client"
```

---

### Task 5: Slack OAuth Routes

**Files:**
- Create: `src/lib/integrations/slack/oauth.ts`
- Create: `src/app/api/integrations/slack/oauth/authorize/route.ts`
- Create: `src/app/api/integrations/slack/oauth/callback/route.ts`
- Modify: `src/middleware.ts` (line 50, add public routes)

**Step 1: Create OAuth helpers at `src/lib/integrations/slack/oauth.ts`**

```typescript
/**
 * Slack OAuth Helpers
 *
 * Handles state JWT creation/verification for CSRF protection.
 */

import { SignJWT, jwtVerify } from 'jose';

const STATE_EXPIRY = '10m';

/**
 * Create a signed state JWT for the OAuth flow.
 */
export async function createOAuthState(orgId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
  return new SignJWT({ orgId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STATE_EXPIRY)
    .setIssuer('ghostly-slack-oauth')
    .sign(secret);
}

/**
 * Verify and decode the OAuth state JWT. Returns the orgId or null.
 */
export async function verifyOAuthState(state: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(state, secret, {
      issuer: 'ghostly-slack-oauth',
    });
    return (payload.orgId as string) || null;
  } catch {
    return null;
  }
}

/**
 * Build the Slack OAuth authorization URL.
 */
export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error('SLACK_CLIENT_ID not configured');

  const scopes = [
    'chat:write',
    'chat:write.public',
    'commands',
    'app_mentions:read',
    'im:history',
    'im:write',
    'channels:read',
    'users:read',
    'files:write',
  ].join(',');

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
```

**Step 2: Create authorize route at `src/app/api/integrations/slack/oauth/authorize/route.ts`**

```typescript
/**
 * GET /api/integrations/slack/oauth/authorize
 *
 * Redirects the user to Slack's OAuth consent page.
 * Requires authentication (user must be logged in).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgId } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/permissions';
import { createOAuthState, buildAuthorizeUrl } from '@/lib/integrations/slack/oauth';

export async function GET(request: NextRequest) {
  try {
    requirePermission(request, 'admin');
    const orgId = getOrgId(request);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const redirectUri = `${baseUrl}/api/integrations/slack/oauth/callback`;

    const state = await createOAuthState(orgId);
    const authorizeUrl = buildAuthorizeUrl(state, redirectUri);

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    console.error('Slack OAuth authorize error:', err);
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', request.url));
  }
}
```

**Step 3: Create callback route at `src/app/api/integrations/slack/oauth/callback/route.ts`**

```typescript
/**
 * GET /api/integrations/slack/oauth/callback
 *
 * Handles the OAuth callback from Slack. Exchanges the code for tokens
 * and stores the integration record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyOAuthState } from '@/lib/integrations/slack/oauth';
import { exchangeOAuthCode } from '@/lib/integrations/slack/client';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;

  // User denied or error from Slack
  if (error) {
    return NextResponse.redirect(`${appUrl}/integrations?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=missing_params`);
  }

  // Verify state JWT
  const orgId = await verifyOAuthState(state);
  if (!orgId) {
    return NextResponse.redirect(`${appUrl}/integrations?error=invalid_state`);
  }

  try {
    const redirectUri = `${appUrl}/api/integrations/slack/oauth/callback`;
    const tokens = await exchangeOAuthCode(code, redirectUri);

    const supabase = await createClient();

    // Upsert the integration record
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert(
        {
          organization_id: orgId,
          type: 'slack',
          status: 'active',
          credentials: {
            bot_token: tokens.bot_token,
            bot_user_id: tokens.bot_user_id,
            team_id: tokens.team_id,
            team_name: tokens.team_name,
            scope: tokens.scope,
          },
          installed_by: tokens.authed_user_id,
        },
        { onConflict: 'organization_id,type' }
      );

    if (dbError) throw dbError;

    // Create default digest config rows
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'slack')
      .single();

    if (integration) {
      await supabase
        .from('integration_digest_config')
        .upsert([
          {
            organization_id: orgId,
            integration_id: integration.id,
            digest_type: 'daily',
            is_enabled: false,
            send_time: '09:00:00',
            day_of_week: 1,
          },
          {
            organization_id: orgId,
            integration_id: integration.id,
            digest_type: 'weekly',
            is_enabled: false,
            send_time: '09:00:00',
            day_of_week: 1,
          },
        ], { onConflict: 'organization_id,integration_id,digest_type' });
    }

    return NextResponse.redirect(`${appUrl}/integrations?success=slack_connected`);
  } catch (err) {
    console.error('Slack OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}/integrations?error=token_exchange_failed`);
  }
}
```

**Step 4: Update middleware to allow public Slack routes**

In `src/middleware.ts`, update the `PUBLIC_API_ROUTES` array (around line 50):

```typescript
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/integrations/slack/oauth/callback',
  '/api/integrations/slack/events',
  '/api/integrations/slack/commands',
];
```

**Step 5: Commit**

```bash
git add src/lib/integrations/slack/oauth.ts src/app/api/integrations/slack/ src/middleware.ts
git commit -m "feat: Slack OAuth flow with CSRF-protected state"
```

---

### Task 6: Integrations API Routes

**Files:**
- Create: `src/app/api/integrations/route.ts`
- Create: `src/app/api/integrations/[id]/route.ts`

**Step 1: Create `src/app/api/integrations/route.ts`**

```typescript
/**
 * GET  /api/integrations - List connected integrations for current org
 * POST /api/integrations - (reserved for non-OAuth integrations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { getRegisteredIntegrations } from '@/lib/integrations/registry';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data: connected, error } = await supabase
      .from('integrations')
      .select('id, type, status, settings, installed_by, created_at, updated_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Include available integrations (registered but maybe not connected)
    const available = getRegisteredIntegrations();

    return NextResponse.json({
      connected: connected || [],
      available,
    });
  }
);
```

**Step 2: Create `src/app/api/integrations/[id]/route.ts`**

```typescript
/**
 * GET    /api/integrations/[id] - Get integration details
 * DELETE /api/integrations/[id] - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId, auditMutation } from '@/lib/api-helpers';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const orgId = getOrgId(request);
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('integrations')
      .select('id, type, status, settings, installed_by, created_at, updated_at')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({ integration: data });
  }
);

export const DELETE = withApiHandler(
  { permission: 'admin', resource: 'integrations' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const orgId = getOrgId(request);
    const { id } = await params;
    const supabase = await createClient();

    // Soft disconnect — keep the record but mark inactive and clear credentials
    const { error } = await supabase
      .from('integrations')
      .update({
        status: 'disconnected',
        credentials: {},
      })
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;

    await auditMutation(request, {
      entity_type: 'integration',
      entity_id: id,
      action: 'disconnected',
      changes: { status: 'disconnected' },
    });

    return NextResponse.json({ success: true });
  }
);
```

**Step 3: Commit**

```bash
git add src/app/api/integrations/
git commit -m "feat: integrations CRUD API routes"
```

---

### Task 7: Slack Agent Tools

**Files:**
- Create: `src/lib/integrations/slack/tools.ts`
- Create: `src/lib/integrations/slack/index.ts`

**Step 1: Create `src/lib/integrations/slack/tools.ts`**

```typescript
/**
 * Slack Agent Tools
 *
 * Tools the agent can use when Slack is connected.
 * These are dynamically loaded via the integration registry.
 */

import type { AgentTool, ToolExecutionContext } from '@/lib/agent/tools';
import { listChannels, postMessage, uploadFile, getSlackBotToken } from './client';
import { createClient } from '@/lib/supabase/server';

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
          return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
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
          const supabase = await createClient();
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
          return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
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
      execute: async (args, context) => {
        const token = await getSlackBotToken(orgId);
        if (!token) return JSON.stringify({ error: 'Slack not connected' });

        let channelId = args.channel_id as string | undefined;

        if (!channelId && args.event_id) {
          const supabase = await createClient();
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
        const supabase = await createClient();
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
          return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
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
        const supabase = await createClient();

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
```

**Step 2: Create `src/lib/integrations/slack/index.ts`**

```typescript
/**
 * Slack Integration Module
 *
 * Registers the Slack integration with the plugin registry.
 */

import type { IntegrationModule } from '@/lib/integrations/types';
import { registerIntegration } from '@/lib/integrations/registry';
import { buildSlackTools } from './tools';

const slackIntegration: IntegrationModule = {
  config: {
    id: 'slack',
    name: 'Slack',
    description: 'Connect Slack to receive notifications, send messages, and interact with the agent via slash commands and DMs.',
    icon: 'MessageSquare',
  },

  getTools(orgId: string, integrationId: string) {
    return buildSlackTools(orgId, integrationId);
  },
};

registerIntegration(slackIntegration);

export default slackIntegration;
```

**Step 3: Import the Slack module in the registry so it auto-registers**

Add to the bottom of `src/lib/integrations/registry.ts`:

```typescript
// ─── Auto-register integrations ─────────────────────────────────────────────
import './slack/index';
```

**Step 4: Commit**

```bash
git add src/lib/integrations/
git commit -m "feat: Slack agent tools and integration module"
```

---

### Task 8: Slack Event & Command Handlers

**Files:**
- Create: `src/lib/integrations/slack/events.ts`
- Create: `src/lib/integrations/slack/commands.ts`
- Create: `src/app/api/integrations/slack/events/route.ts`
- Create: `src/app/api/integrations/slack/commands/route.ts`

**Step 1: Create event handler logic at `src/lib/integrations/slack/events.ts`**

```typescript
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
```

**Step 2: Create command handler at `src/lib/integrations/slack/commands.ts`**

```typescript
/**
 * Slack Slash Command Handler
 *
 * Handles /ghostly slash commands by parsing subcommands
 * and returning formatted responses.
 */

import { createClient } from '@/lib/supabase/server';

interface SlackCommand {
  command: string;
  text: string;
  user_id: string;
  user_name: string;
  channel_id: string;
  team_id: string;
  response_url: string;
  trigger_id: string;
}

interface CommandResponse {
  response_type: 'ephemeral' | 'in_channel';
  text: string;
}

/**
 * Handle a verified slash command.
 */
export async function handleSlackCommand(cmd: SlackCommand): Promise<CommandResponse> {
  const supabase = await createClient();

  // Look up org from team_id
  const { data: integration } = await supabase
    .from('integrations')
    .select('organization_id')
    .eq('type', 'slack')
    .eq('status', 'active')
    .filter('credentials->>team_id', 'eq', cmd.team_id)
    .single();

  if (!integration) {
    return { response_type: 'ephemeral', text: 'Slack integration not found. Please reconnect in Ghostly settings.' };
  }

  const orgId = integration.organization_id;
  const [subcommand, ...rest] = cmd.text.trim().split(/\s+/);
  const argText = rest.join(' ');

  switch (subcommand?.toLowerCase()) {
    case 'events':
      return handleEventsCommand(orgId);
    case 'budget':
      return handleBudgetCommand(orgId, argText);
    case 'overdue':
      return handleOverdueCommand(orgId);
    case 'contacts':
      return handleContactsCommand(orgId, argText);
    case 'help':
    case '':
    case undefined:
      return handleHelpCommand();
    default:
      return {
        response_type: 'ephemeral',
        text: `Unknown command: \`${subcommand}\`. Try \`/ghostly help\` for available commands.`,
      };
  }
}

async function handleEventsCommand(orgId: string): Promise<CommandResponse> {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from('events')
    .select('name, start_date, end_date, location, stage, budget_amount')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .in('stage', ['confirmed', 'in_progress', 'ready', 'active'])
    .order('start_date', { ascending: true })
    .limit(10);

  if (!events || events.length === 0) {
    return { response_type: 'ephemeral', text: 'No upcoming events found.' };
  }

  const lines = events.map((e) => {
    const dates = e.start_date ? `${e.start_date}${e.end_date ? ` - ${e.end_date}` : ''}` : 'TBD';
    const budget = e.budget_amount ? `$${Number(e.budget_amount).toLocaleString()}` : 'No budget';
    return `• *${e.name}* — ${dates} | ${e.location || 'No location'} | ${budget} | _${e.stage}_`;
  });

  return {
    response_type: 'ephemeral',
    text: `*Upcoming Events (${events.length}):*\n${lines.join('\n')}`,
  };
}

async function handleBudgetCommand(orgId: string, eventName: string): Promise<CommandResponse> {
  const supabase = await createClient();

  if (!eventName) {
    return { response_type: 'ephemeral', text: 'Usage: `/ghostly budget <event name>`' };
  }

  const { data: events } = await supabase
    .from('events')
    .select('id, name, budget_amount')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .ilike('name', `%${eventName}%`)
    .limit(1);

  if (!events || events.length === 0) {
    return { response_type: 'ephemeral', text: `No event found matching "${eventName}"` };
  }

  const event = events[0];

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('event_id', event.id)
    .eq('organization_id', orgId)
    .is('deleted_at', null);

  const totalSpent = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const budget = Number(event.budget_amount || 0);
  const remaining = budget - totalSpent;
  const pct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  return {
    response_type: 'ephemeral',
    text: `*Budget for ${event.name}:*\n• Budget: $${budget.toLocaleString()}\n• Spent: $${totalSpent.toLocaleString()} (${pct}%)\n• Remaining: $${remaining.toLocaleString()}`,
  };
}

async function handleOverdueCommand(orgId: string): Promise<CommandResponse> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: items } = await supabase
    .from('event_checklist_items')
    .select('title, due_date, events!inner(name, organization_id)')
    .is('completed_at', null)
    .lt('due_date', today)
    .limit(10);

  const filtered = (items || []).filter(
    (item) => (item.events as unknown as { organization_id: string })?.organization_id === orgId
  );

  if (filtered.length === 0) {
    return { response_type: 'ephemeral', text: 'No overdue checklist items. Nice work!' };
  }

  const lines = filtered.map((item) => {
    const eventName = (item.events as unknown as { name: string })?.name || 'Unknown';
    return `• *${item.title}* — ${eventName} (due ${item.due_date})`;
  });

  return {
    response_type: 'ephemeral',
    text: `*Overdue Items (${filtered.length}):*\n${lines.join('\n')}`,
  };
}

async function handleContactsCommand(orgId: string, query: string): Promise<CommandResponse> {
  const supabase = await createClient();

  if (!query) {
    return { response_type: 'ephemeral', text: 'Usage: `/ghostly contacts <search term>`' };
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('first_name, last_name, company, title, email')
    .eq('organization_id', orgId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,company.ilike.%${query}%`)
    .limit(5);

  if (!contacts || contacts.length === 0) {
    return { response_type: 'ephemeral', text: `No contacts found matching "${query}"` };
  }

  const lines = contacts.map((c) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    const role = [c.title, c.company].filter(Boolean).join(' at ');
    return `• *${name}*${role ? ` — ${role}` : ''}${c.email ? ` | ${c.email}` : ''}`;
  });

  return {
    response_type: 'ephemeral',
    text: `*Contacts (${contacts.length}):*\n${lines.join('\n')}`,
  };
}

function handleHelpCommand(): CommandResponse {
  return {
    response_type: 'ephemeral',
    text: `*Ghostly Commands:*
• \`/ghostly events\` — List upcoming events
• \`/ghostly budget <event name>\` — Budget summary for an event
• \`/ghostly overdue\` — Overdue checklist items
• \`/ghostly contacts <search>\` — Search contacts
• \`/ghostly help\` — Show this help message`,
  };
}
```

**Step 3: Create events API route at `src/app/api/integrations/slack/events/route.ts`**

```typescript
/**
 * POST /api/integrations/slack/events
 *
 * Receives events from Slack (app_mention, message.im).
 * Public route — verified via Slack signing secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySlackNextRequest } from '@/lib/integrations/slack/verification';
import { handleSlackEvent } from '@/lib/integrations/slack/events';

export async function POST(request: NextRequest) {
  const { verified, body } = await verifySlackNextRequest(request);

  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // Handle Slack URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Handle event callbacks
  if (payload.type === 'event_callback') {
    const eventType = payload.event?.type;

    if (eventType === 'app_mention' || eventType === 'message') {
      // Process async — respond to Slack within 3 seconds
      handleSlackEvent(payload).catch((err) => {
        console.error('Async Slack event handling failed:', err);
      });
    }
  }

  // Always respond 200 quickly
  return NextResponse.json({ ok: true });
}
```

**Step 4: Create commands API route at `src/app/api/integrations/slack/commands/route.ts`**

```typescript
/**
 * POST /api/integrations/slack/commands
 *
 * Receives slash commands from Slack (/ghostly).
 * Public route — verified via Slack signing secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySlackNextRequest } from '@/lib/integrations/slack/verification';
import { handleSlackCommand } from '@/lib/integrations/slack/commands';

export async function POST(request: NextRequest) {
  const { verified, body } = await verifySlackNextRequest(request);

  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Slack sends commands as form-urlencoded
  const params = new URLSearchParams(body);
  const command = {
    command: params.get('command') || '',
    text: params.get('text') || '',
    user_id: params.get('user_id') || '',
    user_name: params.get('user_name') || '',
    channel_id: params.get('channel_id') || '',
    team_id: params.get('team_id') || '',
    response_url: params.get('response_url') || '',
    trigger_id: params.get('trigger_id') || '',
  };

  try {
    const response = await handleSlackCommand(command);
    return NextResponse.json(response);
  } catch (err) {
    console.error('Slash command error:', err);
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Something went wrong processing your command. Please try again.',
    });
  }
}
```

**Step 5: Commit**

```bash
git add src/lib/integrations/slack/ src/app/api/integrations/slack/
git commit -m "feat: Slack event and slash command handlers"
```

---

### Task 9: Notification Routing

**Files:**
- Create: `src/lib/integrations/slack/notifications.ts`
- Modify: `src/app/api/notifications/route.ts` (POST handler, around line 101)
- Create: `src/app/api/integrations/notification-routes/route.ts`

**Step 1: Create notification routing logic at `src/lib/integrations/slack/notifications.ts`**

```typescript
/**
 * Slack Notification Routing
 *
 * When a notification is created in Ghostly, check if there's a Slack
 * routing rule and forward it to the appropriate channel/DM.
 */

import { createClient } from '@/lib/supabase/server';
import { postMessage, openDM, getSlackBotToken } from './client';

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
  const supabase = await createClient();

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
```

**Step 2: Hook into notification creation in `src/app/api/notifications/route.ts`**

Add import at the top:

```typescript
import { routeNotificationToSlack } from '@/lib/integrations/slack/notifications';
```

After the notification is inserted (after line 113, after `if (error) throw error;`), add:

```typescript
    // Fire-and-forget: route to Slack if configured
    routeNotificationToSlack(orgId, body.type, title, message, body.metadata).catch(() => {});
```

**Step 3: Create notification routes config API at `src/app/api/integrations/notification-routes/route.ts`**

```typescript
/**
 * GET /api/integrations/notification-routes - Get routing config
 * PUT /api/integrations/notification-routes - Update routing config
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

const VALID_NOTIFICATION_TYPES = [
  'agent_message',
  'budget_alert',
  'task_reminder',
  'custom_reminder',
];

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data: routes, error } = await supabase
      .from('integration_notification_routes')
      .select('*')
      .eq('organization_id', orgId);

    if (error) throw error;

    return NextResponse.json({ routes: routes || [] });
  }
);

export const PUT = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (!Array.isArray(body.routes)) {
      return NextResponse.json({ error: 'routes must be an array' }, { status: 400 });
    }

    // Get the active Slack integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'slack')
      .eq('status', 'active')
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'No active Slack integration' }, { status: 400 });
    }

    // Upsert each route
    const upsertData = body.routes
      .filter((r: { notification_type: string }) =>
        VALID_NOTIFICATION_TYPES.includes(r.notification_type)
      )
      .map((r: { notification_type: string; destination: string; is_enabled: boolean }) => ({
        organization_id: orgId,
        integration_id: integration.id,
        notification_type: r.notification_type,
        destination: r.destination || 'dm',
        is_enabled: r.is_enabled ?? true,
      }));

    const { error } = await supabase
      .from('integration_notification_routes')
      .upsert(upsertData, {
        onConflict: 'organization_id,integration_id,notification_type',
      });

    if (error) throw error;

    // Fetch updated routes
    const { data: routes } = await supabase
      .from('integration_notification_routes')
      .select('*')
      .eq('organization_id', orgId);

    return NextResponse.json({ routes: routes || [] });
  }
);
```

**Step 4: Commit**

```bash
git add src/lib/integrations/slack/notifications.ts src/app/api/notifications/route.ts src/app/api/integrations/notification-routes/
git commit -m "feat: Slack notification routing system"
```

---

### Task 10: Event Channel Mapping & Digest Config APIs

**Files:**
- Create: `src/app/api/integrations/event-channels/route.ts`
- Create: `src/app/api/integrations/digest-config/route.ts`

**Step 1: Create event channels API at `src/app/api/integrations/event-channels/route.ts`**

```typescript
/**
 * GET    /api/integrations/event-channels - List event-channel mappings
 * POST   /api/integrations/event-channels - Create/update mapping
 * DELETE /api/integrations/event-channels - Remove mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();
    const url = new URL(request.url);
    const eventId = url.searchParams.get('event_id');

    let query = supabase
      .from('integration_event_channels')
      .select('*')
      .eq('organization_id', orgId);

    if (eventId) query = query.eq('event_id', eventId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ event_channels: data || [] });
  }
);

export const POST = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (!body.event_id || !body.slack_channel_id) {
      return NextResponse.json({ error: 'event_id and slack_channel_id required' }, { status: 400 });
    }

    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'slack')
      .eq('status', 'active')
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'No active Slack integration' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('integration_event_channels')
      .upsert(
        {
          organization_id: orgId,
          integration_id: integration.id,
          event_id: body.event_id,
          slack_channel_id: body.slack_channel_id,
          slack_channel_name: body.slack_channel_name || '',
        },
        { onConflict: 'organization_id,integration_id,event_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ event_channel: data }, { status: 201 });
  }
);

export const DELETE = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (!body.event_id) {
      return NextResponse.json({ error: 'event_id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('integration_event_channels')
      .delete()
      .eq('organization_id', orgId)
      .eq('event_id', body.event_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  }
);
```

**Step 2: Create digest config API at `src/app/api/integrations/digest-config/route.ts`**

```typescript
/**
 * GET /api/integrations/digest-config - Get digest settings
 * PUT /api/integrations/digest-config - Update digest settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('integration_digest_config')
      .select('*')
      .eq('organization_id', orgId);

    if (error) throw error;
    return NextResponse.json({ digests: data || [] });
  }
);

export const PUT = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (!body.digest_type || !['daily', 'weekly'].includes(body.digest_type)) {
      return NextResponse.json({ error: 'digest_type must be daily or weekly' }, { status: 400 });
    }

    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'slack')
      .eq('status', 'active')
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'No active Slack integration' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      organization_id: orgId,
      integration_id: integration.id,
      digest_type: body.digest_type,
    };

    if (body.is_enabled !== undefined) updateData.is_enabled = body.is_enabled;
    if (body.send_time) updateData.send_time = body.send_time;
    if (body.day_of_week !== undefined) updateData.day_of_week = body.day_of_week;

    const { data, error } = await supabase
      .from('integration_digest_config')
      .upsert(updateData, {
        onConflict: 'organization_id,integration_id,digest_type',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ digest: data });
  }
);
```

**Step 3: Commit**

```bash
git add src/app/api/integrations/event-channels/ src/app/api/integrations/digest-config/
git commit -m "feat: event channel mapping and digest config APIs"
```

---

### Task 11: Digest Generation

**Files:**
- Create: `src/lib/integrations/slack/digests.ts`
- Create: `src/app/api/integrations/slack/digest/route.ts`

**Step 1: Create digest generator at `src/lib/integrations/slack/digests.ts`**

```typescript
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
```

**Step 2: Create digest cron endpoint at `src/app/api/integrations/slack/digest/route.ts`**

```typescript
/**
 * POST /api/integrations/slack/digest
 *
 * Triggers digest generation. Intended to be called by a cron job.
 * Accepts { type: 'daily' | 'weekly' }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDigests } from '@/lib/integrations/slack/digests';

export async function POST(request: NextRequest) {
  // Simple API key check for cron security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const digestType = body.type as 'daily' | 'weekly';

    if (!digestType || !['daily', 'weekly'].includes(digestType)) {
      return NextResponse.json({ error: 'type must be daily or weekly' }, { status: 400 });
    }

    const sent = await processDigests(digestType);

    return NextResponse.json({ success: true, digests_sent: sent });
  } catch (err) {
    console.error('Digest cron error:', err);
    return NextResponse.json({ error: 'Digest processing failed' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/integrations/slack/digests.ts src/app/api/integrations/slack/digest/
git commit -m "feat: Slack digest generation and cron endpoint"
```

---

### Task 12: Frontend - Integrations Page

**Files:**
- Create: `src/app/integrations/page.tsx`
- Modify: `src/components/layout/AppShell.tsx` (add nav item, around line 52)

**Step 1: Create the integrations page at `src/app/integrations/page.tsx`**

Build a full-featured integrations settings page following the existing UI patterns from `src/app/settings/agent/page.tsx`. The page should include:

**Structure:**
- Wrapped in `<AppShell>` with page header (icon badge + title + description)
- Check for `?success=slack_connected` or `?error=...` query params and show toast
- Fetch integration data on mount: `GET /api/integrations`, `GET /api/integrations/notification-routes`, `GET /api/integrations/digest-config`

**Sections (collapsible cards, following the `SectionKey` pattern from agent settings):**

1. **Connection Status Card**
   - If Slack not connected: Show "Connect Slack" button that links to `/api/integrations/slack/oauth/authorize`
   - If connected: Show workspace name (from credentials.team_name), status badge, "Disconnect" button
   - Disconnect calls `DELETE /api/integrations/[id]`

2. **Notification Routing Card** (only shown when Slack is connected)
   - Table/grid of notification types with:
     - Type name and icon (matching NotificationPanel's TYPE_CONFIG)
     - Toggle switch for enabled/disabled
     - Channel selector dropdown (populated from `slack_list_channels` API or hardcoded to 'dm' for now)
   - Save button calls `PUT /api/integrations/notification-routes`

3. **Event Channel Mappings Card** (only shown when connected)
   - List of events with linked channels
   - "Link Channel" button per event — dropdown to pick channel
   - "Unlink" button to remove mapping
   - Uses `GET/POST/DELETE /api/integrations/event-channels`

4. **Digest Settings Card** (only shown when connected)
   - Daily digest: toggle, time picker
   - Weekly digest: toggle, day-of-week picker, time picker
   - Save button calls `PUT /api/integrations/digest-config`

**UI Patterns to follow:**
- Use `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` from `@/components/ui/Card`
- Use `Button` component with appropriate variants
- Icon badges: `<div className="p-2 rounded-md bg-spectral/10 text-spectral">`
- Input classes: `w-full px-4 py-2.5 rounded-md bg-background border border-border text-foreground focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors duration-200`
- Loading: `<RefreshCw className="animate-spin" />`
- Collapsible sections with `ChevronDown`/`ChevronRight` toggle pattern
- Error/success via toast or inline messages
- Lucide icons: `MessageSquare` for Slack, `Bell` for notifications, `Link` for channels, `Calendar` for digests

**Step 2: Add nav item to `src/components/layout/AppShell.tsx`**

Add a new entry to the `navItems` array (after the Webhooks entry around line 52):

```typescript
{ name: "Integrations", href: "/integrations", icon: Zap },
```

Import `Zap` from lucide-react at the top.

**Step 3: Commit**

```bash
git add src/app/integrations/ src/components/layout/AppShell.tsx
git commit -m "feat: integrations settings page and nav item"
```

---

### Task 13: Frontend - Event Channel Selector

**Files:**
- Modify: `src/app/events/[id]/page.tsx` (add Slack channel field to event details tab)

**Step 1: Add Slack channel linking to event detail page**

In the event detail page, add a "Slack Channel" section in the details tab. This should:

- Fetch the current channel mapping: `GET /api/integrations/event-channels?event_id={id}`
- Check if Slack is connected: `GET /api/integrations` and check for active Slack integration
- If Slack is connected, show:
  - Current linked channel (if any) with channel name
  - "Link Channel" button that opens a small inline form
  - Channel search/select using `GET /api/integrations/slack/channels?query=...` (you'll need a small proxy API or fetch channels from the Slack client)
  - "Unlink" button if a channel is linked
- If Slack is not connected, show nothing (don't add visual noise)

**Implementation approach:**
- Add state variables for `slackChannel` and `slackConnected`
- Fetch on mount alongside other event data
- Use POST/DELETE to `/api/integrations/event-channels` for linking/unlinking
- Keep it minimal — just a text display of channel name + link/unlink buttons

**Step 2: Create a small channels proxy API at `src/app/api/integrations/slack/channels/route.ts`**

```typescript
/**
 * GET /api/integrations/slack/channels?query=search
 *
 * Proxy to list Slack channels for the current org.
 * Used by the frontend channel selector.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { getSlackBotToken } from '@/lib/integrations/slack/client';
import { listChannels } from '@/lib/integrations/slack/client';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || undefined;

    const token = await getSlackBotToken(orgId);
    if (!token) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 });
    }

    const result = await listChannels(token, { query, limit: 50 });
    return NextResponse.json({ channels: result.channels });
  }
);
```

**Step 3: Commit**

```bash
git add src/app/events/ src/app/api/integrations/slack/channels/
git commit -m "feat: event channel linking in event detail page"
```

---

### Task 14: Verification & Final Touches

**Step 1: Run TypeScript check**

```bash
cd "/Users/treynor/Documents/APP REPO/ghostly" && npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run linter**

```bash
cd "/Users/treynor/Documents/APP REPO/ghostly" && npm run lint
```

Fix any lint errors.

**Step 3: Run tests**

```bash
cd "/Users/treynor/Documents/APP REPO/ghostly" && npm test
```

Ensure existing tests still pass.

**Step 4: Build**

```bash
cd "/Users/treynor/Documents/APP REPO/ghostly" && npm run build
```

Fix any build errors.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type and lint errors from Slack integration"
```

---

## Slack App Setup Instructions (For the User)

After implementation, the user needs to:

1. Go to https://api.slack.com/apps and click "Create New App" → "From scratch"
2. Name it (e.g., "Ghostly") and select their workspace
3. Under **OAuth & Permissions**, add bot scopes: `chat:write`, `chat:write.public`, `commands`, `app_mentions:read`, `im:history`, `im:write`, `channels:read`, `users:read`, `files:write`
4. Set the redirect URL: `https://your-app-url/api/integrations/slack/oauth/callback`
5. Under **Event Subscriptions**, enable and set request URL: `https://your-app-url/api/integrations/slack/events`
6. Subscribe to bot events: `app_mention`, `message.im`
7. Under **Slash Commands**, create `/ghostly` with request URL: `https://your-app-url/api/integrations/slack/commands`
8. Under **Basic Information**, copy Client ID, Client Secret, and Signing Secret to env vars
9. Install the app to workspace via the Ghostly integrations page
