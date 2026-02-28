# Ghostly MCP Server

Connects Claude Desktop, Cursor, and any MCP-compatible AI client to your [Ghostly](https://github.com/treynortetik-creator/ghostly) event management platform via the **Model Context Protocol**.

> **What this means:** Instead of building an internal AI agent layer (rejected approach), Ghostly exposes its core functionality as MCP tools. Users bring their own Claude/GPT account, point it at this MCP server, and their AI can create events, track budgets, assign vendors, and pull event summaries — all through natural language.

---

## Architecture

```
Claude Desktop / Cursor / Any MCP Client
           │
           │  stdio (MCP protocol)
           ▼
   ghostly-mcp server (this package)
           │
           │  HTTP + x-api-key
           ▼
   Ghostly REST API
           │
           ▼
      Supabase Database
```

---

## Prerequisites

- Node.js 18 or higher
- A running Ghostly instance (self-hosted or Railway)
- A Ghostly API key (see Setup below)

---

## Setup

### 1. Get a Ghostly API Key

1. Log into your Ghostly instance
2. Go to **Settings → API Keys**
3. Click **Create API Key**
4. Set `agent_name` to `ghostly-mcp` and permissions to `["read", "write"]`
5. Copy the generated key (shown once)

### 2. Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

This compiles TypeScript to `dist/index.js`.

### 3. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop. You'll see "ghostly" appear in the tools list.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `list_event_types` | List available event types (Executive, National, State, etc.) with their UUIDs |
| `list_events` | List events with optional filters (search, quarter). Returns budget and spend. |
| `create_event` | Create a new event with name, type, quarter, and budget |
| `get_event_summary` | Get full budget vs actual, ROI metrics, checklist progress, team count |
| `add_budget_line` | Record an actual expense against an event budget |
| `assign_vendor` | Create a budget placeholder for a vendor (for planning before invoice) |

---

## Example Prompts

Once connected, you can ask Claude:

- *"Create a new National event called 'SafelyYou Summit 2026' in Q3 with a $15,000 budget in Nashville"*
- *"What's the current budget vs actual for all Q2 events?"*
- *"Add a $3,200 AV expense from SoundPro for the Chicago Regional event — invoice date was February 20th"*
- *"Assign Marriott as the venue vendor for the NYC Executive event, estimated cost $8,000"*
- *"Give me a full summary of the NIC Spring event — budget health, ROI metrics, checklist"*
- *"List all events in Q1 that are over budget"*

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GHOSTLY_URL` | Yes | Base URL of your Ghostly instance (no trailing slash) |
| `GHOSTLY_API_KEY` | Yes | API key from Ghostly Settings → API Keys |

---

## Development

```bash
# Run in development mode (TypeScript, no compile step)
npm run dev

# Rebuild after changes
npm run build

# Test the server manually (MCP uses stdio)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | GHOSTLY_URL=http://localhost:3000 GHOSTLY_API_KEY=test node dist/index.js
```

---

## Tier Model (Ghostly Business)

- **Tier 1 (self-serve):** User subscribes to Ghostly platform + sets up their own Claude account and this MCP server themselves.
- **Tier 2 (white glove):** Treynor creates the API key, builds the MCP config, and links it to their Claude Desktop instance. One-time setup fee, high margin.

---

## Version History

- `0.1.0` — Initial release: 6 core tools (list_event_types, list_events, create_event, get_event_summary, add_budget_line, assign_vendor)
