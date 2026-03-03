# Ghostly 👻

**AI-powered event financial management for B2B event marketing teams.**

The invisible AI agent running your events behind the scenes.

---

## What Ghostly Does

Ghostly is the platform B2B event marketers have been missing. It manages:

- **Event budget tracking** — budget vs. actual, line-item expenses, over-budget alerts
- **Team assignments** — who's attending each event, travel, logistics
- **Pre-show task checklists** — nothing falls through the cracks
- **Post-event close** — budget summary, ROI snapshot, lessons learned
- **Attendee scrubber** — match conference attendee lists against your CRM

Powered by an MCP-first AI layer. Use it via Claude Desktop or the web UI.

---

## Architecture

- **Frontend:** Next.js 15 + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + RLS + Auth)
- **AI layer:** MCP server (see `/mcp-server/`)
- **Auth:** Supabase Auth (email + Google OAuth)

---

## MCP Server

The Ghostly MCP server exposes your events data to any MCP-compatible AI client (Claude Desktop, GPT, etc.).

Current coverage:
- Full parity with Ghostly's embedded agent core tools (events, expenses, travel/logistics, post-event debriefs, team, documents, memory/learnings, background tasks, observability)
- Backward-compatible aliases for the original MCP names (`list_events`, `list_event_types`, `get_event_summary`, `add_budget_line`, `assign_vendor`)

See [mcp-server/README.md](./mcp-server/README.md) for Claude Desktop setup.

---

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Run database migrations
# (in Supabase dashboard or via CLI)

# Start dev server
npm run dev
```

---

## Demo Data

For demo purposes, load realistic sample event data:

```bash
# In Supabase SQL Editor:
# Run: tmp/ghostly-demo-data.sql
```

---

## Roadmap

**Sprint 0 (Current):** Fork from Counting House, rename, clean up
**Phase 0:** Multi-tenant foundation (Supabase Auth + RLS from scratch)  
**Phase 1:** Core product (event management, budget grid, team, tasks, docs)  
**Phase 2:** AI layer (Gemini Flash embedded chat, Ghostly MCP v2)  
**Phase 3:** GTM (billing, self-serve onboarding, ghostly.ai launch)

---

## About

Ghostly is built by Treynor Tetik. The AI agent is invisible. The events aren't.

**Domain:** ghostly.ai (coming soon)  
**Status:** Private beta — [request early access](mailto:treynor.tetik@gmail.com)

---

*Forked from Counting House (internal SafelyYou events management tool). Counting House stays as-is; Ghostly is the standalone commercial product.*
