# Ghostly MCP Server

Ghostly MCP exposes your Ghostly API as Model Context Protocol tools so Claude Desktop, Cursor, and other MCP clients can read and mutate event operations directly.

## Requirements

- Node.js 18+
- A running Ghostly instance
- A Ghostly API key with `read` and `write` scopes

## Install and Build

```bash
cd mcp-server
npm install
npm run build
```

## Environment Variables

- `GHOSTLY_URL` (required): Ghostly base URL, example `https://ghostly-production.up.railway.app`
- `GHOSTLY_API_KEY` (required): API key from Ghostly Settings -> API Keys
- `GHOSTLY_DEFAULT_FISCAL_YEAR_ID` (optional): fallback fiscal year for `list_event_types`

## Claude Desktop Setup

Update `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ghostly": {
      "command": "node",
      "args": ["/absolute/path/to/ghostly/mcp-server/dist/index.js"],
      "env": {
        "GHOSTLY_URL": "https://your-ghostly-instance.railway.app",
        "GHOSTLY_API_KEY": "gh_live_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

## Cursor Setup

Add the same server definition in Cursor MCP settings (command + args + env).

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

## Quick Smoke Test

```bash
cd mcp-server
npm run build

echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | GHOSTLY_URL=https://your-ghostly-instance.railway.app \
    GHOSTLY_API_KEY=gh_live_xxx \
    node dist/index.js
```

If setup is correct, you will get a JSON-RPC response listing all Ghostly MCP tools.
