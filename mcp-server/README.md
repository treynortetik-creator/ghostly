# Shindig MCP Server

Connects Claude Desktop, Cursor, and any MCP-compatible AI client to your [Counting House](https://github.com/treynortetik-creator/counting_house) event management platform via the **Model Context Protocol**.

> **What this means:** Instead of building an internal AI agent layer (rejected approach), Shindig exposes its core functionality as MCP tools. Users bring their own Claude/GPT account, point it at this MCP server, and their AI can create events, track budgets, assign vendors, and pull event summaries — all through natural language.

---

## Architecture

```
Claude Desktop / Cursor / Any MCP Client
           │
           │  stdio (MCP protocol)
           ▼
   shindig-mcp server (this package)
           │
           │  HTTP + x-api-key
           ▼
   Counting House REST API
           │
           ▼
      Supabase Database
```

---

## Prerequisites

- Node.js 18 or higher
- A running Counting House instance (self-hosted or Railway)
- A Counting House API key (see Setup below)

---

## Setup

### 1. Get a Counting House API Key

1. Log into your Counting House instance
2. Go to **Settings → API Keys**
3. Click **Create API Key**
4. Set `agent_name` to `shindig-mcp` and permissions to `["read", "write"]`
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
    "shindig": {
      "command": "node",
      "args": ["/absolute/path/to/counting_house/mcp-server/dist/index.js"],
      "env": {
        "COUNTING_HOUSE_URL": "https://your-counting-house.railway.app",
        "COUNTING_HOUSE_API_KEY": "ch_live_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see "shindig" appear in the tools list.

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
| `COUNTING_HOUSE_URL` | ✅ | Base URL of your Counting House instance (no trailing slash) |
| `COUNTING_HOUSE_API_KEY` | ✅ | API key from Counting House Settings → API Keys |

---

## Development

```bash
# Run in development mode (TypeScript, no compile step)
npm run dev

# Rebuild after changes
npm run build

# Test the server manually (MCP uses stdio)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | COUNTING_HOUSE_URL=http://localhost:3000 COUNTING_HOUSE_API_KEY=test node dist/index.js
```

---

## Tier Model (Shindig Business)

- **Tier 1 (self-serve):** User subscribes to Counting House platform + sets up their own Claude account and this MCP server themselves.
- **Tier 2 (white glove):** Treynor creates the API key, builds the MCP config, and links it to their Claude Desktop instance. One-time setup fee, high margin.

---

## Version History

- `0.1.0` — Initial release: 6 core tools (list_event_types, list_events, create_event, get_event_summary, add_budget_line, assign_vendor)
