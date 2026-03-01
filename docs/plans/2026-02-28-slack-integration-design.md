# Slack Integration Design

**Date:** 2026-02-28
**Status:** Approved

## Goal

Add Slack OAuth app integration to Ghostly, enabling the built-in agent to message via Slack, deliver notifications and scheduled digests, respond to slash commands, and handle direct conversations — all through a modular plugin architecture that supports future integrations.

## Architecture Decisions

### 1. One Slack Workspace Per Organization

Each org installs the Slack app to their own workspace. The bot token is stored against the org. Slash commands and events route to the correct org via the stored workspace mapping.

### 2. Plugin/Integration Architecture (Not MCP)

A lightweight integration registry system where each integration is a self-contained module that registers its tools, auth flow, and config schema. The agent dynamically loads tools only from integrations the org has connected. This avoids tool bloat (the agent currently has 15 tools) while maintaining clean separation.

**Future migration path:** Each plugin module's interface maps directly to MCP tool schemas, so migrating to full MCP later is a refactor, not a rewrite.

### 3. Three Interaction Modes

- **Slash commands** — Quick structured queries (`/ghostly events`, `/ghostly budget CES`, `/ghostly overdue`)
- **DM the bot** — Full conversational agent access (same as in-app chat)
- **@mention in channels** — Same as DM but in a channel thread

### 4. Flexible Notification Routing

- Per notification type → specific Slack channel
- Per event → linked Slack channel
- User toggle per notification type (enabled/disabled for Slack)
- Document delivery to Slack (file attachments)

### 5. DM-First Digests

Daily/weekly digest summaries delivered as DMs to the installing user. Agent-generated (contextual, not static templates). Content includes: upcoming events, overdue tasks, budget status, milestone alerts.

### 6. Manual Channel Mapping

Users manually link Slack channels to events. The agent has a `slack_list_channels` tool to search for channels and can suggest mappings.

### 7. No Additional NPM Packages

Raw `fetch` for Slack API calls (consistent with existing OpenRouter pattern). Built-in `crypto` for HMAC-SHA256 signature verification. `jose` (already installed) for OAuth state JWTs.

## Database Schema

### New Tables

**`integrations`**
- `id` (uuid PK), `organization_id` (FK), `type` (text, e.g. 'slack')
- `status` (text: active/disconnected)
- `credentials` (JSONB — bot_token, team_id, team_name, bot_user_id)
- `settings` (JSONB — default_channel, preferences)
- `installed_by` (text), `created_at`, `updated_at`

**`integration_notification_routes`**
- `id` (uuid PK), `organization_id` (FK), `integration_id` (FK)
- `notification_type` (text), `destination` (text — channel ID or 'dm')
- `is_enabled` (boolean)

**`integration_event_channels`**
- `id` (uuid PK), `organization_id` (FK), `integration_id` (FK)
- `event_id` (FK), `slack_channel_id` (text), `slack_channel_name` (text)
- `created_at`

**`integration_digest_config`**
- `id` (uuid PK), `organization_id` (FK), `integration_id` (FK)
- `digest_type` (text: daily/weekly)
- `is_enabled` (boolean), `send_time` (time), `day_of_week` (int, 0-6)
- `recipient_type` (text, default 'dm')

## File Structure

```
src/lib/integrations/
├── types.ts              # Integration interface
├── registry.ts           # Registration + dynamic tool loading
└── slack/
    ├── index.ts           # SlackIntegration class
    ├── oauth.ts           # OAuth v2 helpers
    ├── client.ts          # Slack API wrapper (raw fetch)
    ├── verification.ts    # Request signature verification
    ├── tools.ts           # Agent tools (4 tools)
    ├── events.ts          # Event/DM handler logic
    ├── commands.ts        # Slash command handler logic
    └── digests.ts         # Digest generation

src/app/api/integrations/
├── route.ts               # GET list, POST connect
├── [id]/
│   └── route.ts           # GET/DELETE single integration
├── slack/
│   ├── oauth/
│   │   ├── authorize/route.ts    # GET → redirect to Slack
│   │   └── callback/route.ts     # GET → handle OAuth callback
│   ├── events/route.ts           # POST → Slack events (public)
│   └── commands/route.ts         # POST → slash commands (public)
├── notification-routes/route.ts  # GET/PUT routing config
├── event-channels/route.ts       # GET/POST/DELETE event mappings
└── digest-config/route.ts        # GET/PUT digest settings

src/app/integrations/
└── page.tsx               # Integrations settings UI
```

## Slack App Configuration

**Scopes:** `chat:write`, `chat:write.public`, `commands`, `app_mentions:read`, `im:history`, `im:write`, `channels:read`, `users:read`, `files:write`

**Event Subscriptions:** `app_mention`, `message.im`

**Slash Commands:** `/ghostly` with subcommands parsed server-side

## Agent Tools (4 new tools)

1. `slack_list_channels` — Search/list workspace channels
2. `slack_send_message` — Send message to channel or DM
3. `slack_send_document` — Upload file to channel
4. `slack_link_event_channel` — Map event to Slack channel

## Environment Variables

```
SLACK_CLIENT_ID=your_slack_app_client_id
SLACK_CLIENT_SECRET=your_slack_app_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
```
