# Ghostly MCP Server

Ghostly MCP exposes Ghostly API operations as MCP tools.

It now supports two transport modes:

- `http` (recommended for Railway / production)
- `stdio` (local process mode for desktop clients)

## Requirements

- Node.js 18+
- A running Ghostly app/API

## Install and Build

```bash
cd mcp-server
npm install
npm run build
```

## Environment Variables

- `GHOSTLY_URL` (required): Ghostly app base URL (for API calls)
- `MCP_TRANSPORT` (optional): `http` or `stdio`
  - default is `http` when `PORT` is set
  - otherwise default is `stdio`
- `GHOSTLY_API_KEY` (optional): service-level fallback API key
  - required for `stdio`
  - optional for `http` (recommended to use per-user bearer keys)
- `GHOSTLY_DEFAULT_FISCAL_YEAR_ID` (optional): fallback fiscal year for `list_event_types`
- `PORT` / `MCP_PORT` (optional): HTTP port in `http` mode (default `3000`)
- `MCP_HOST` (optional): bind host in `http` mode (default `0.0.0.0`)

## Railway Deployment (Recommended)

Run MCP as a **separate Railway service** in the same repo:

1. Add new service from this repo.
2. Set **Root Directory** to `mcp-server`.
3. Build command: `npm install && npm run build`
4. Start command: `npm run start:http`
5. Set env vars:
   - `MCP_TRANSPORT=http`
   - `GHOSTLY_URL=https://<your-main-ghostly-domain>`
6. Deploy.

Hosted MCP endpoints:

- `POST /mcp` (MCP tool calls)
- `GET /healthz` (health)

### Multi-Org Auth Model

For hosted mode, each user/client should send:

- `Authorization: Bearer <ghostly_api_key>`

The MCP service forwards that key to Ghostly API as `x-api-key`, and Ghostly middleware resolves org + permissions from that key.

This enables account-level isolation without a global shared key.

## Local Stdio Mode

Use for local desktop MCP process mode:

```bash
cd mcp-server
MCP_TRANSPORT=stdio GHOSTLY_URL=https://your-ghostly-instance.railway.app GHOSTLY_API_KEY=gh_live_xxx node dist/index.js
```

## Tool Coverage

`v0.2.0` ships full parity with the embedded Ghostly agent core tools, plus compatibility aliases.

### Events, ROI, and Planning

- `get_events`
- `get_event_detail`
- `create_event`
- `update_event`
- `update_event_roi`
- `get_over_budget_events`
- `get_overdue_tasks`
- `create_checklist_item`
- `generate_post_event_debrief`

### Expenses, Vendors, and Categories

- `get_expenses`
- `create_expense`
- `create_vendor`
- `create_category`
- `create_event_type`
- `search`

### Team and Documents

- `get_team_members`
- `create_team_member`
- `assign_team_member_to_event`
- `get_event_documents`
- `read_document`
- `attach_document`
- `generate_document`

### Travel and Logistics

- `get_travel_logistics`
- `create_travel_logistics_entry`
- `update_travel_logistics_entry`
- `delete_travel_logistics_entry`

### Agent Runtime, Memory, and Observability

- `run_background_task`
- `get_background_tasks`
- `save_learning`
- `get_learnings`
- `save_memory`
- `recall_memory`
- `get_agent_runs`
- `get_session_history`

### Compatibility Aliases

- `list_fiscal_years`
- `list_event_types`
- `list_events`
- `get_event_summary`
- `add_budget_line`
- `assign_vendor`
