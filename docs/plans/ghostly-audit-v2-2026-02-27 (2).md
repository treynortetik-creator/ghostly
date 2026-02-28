# Ghostly Comprehensive Audit Report v2
**Date:** 2026-02-27
**Scope:** Full codebase audit — UI/UX, functionality, security, refactoring, database integrity, and feature planning
**v2 Changes:** Added Sprint 0 (Multi-Tenancy + OAuth), reordered all sprints, flagged CH-specific DB hardcoding as customer blockers

---

## Executive Summary

Ghostly is a mature Next.js 16 event management and budget tracking platform with 16 pages, 68 API routes, and 25 database tables. The app was recently forked from "The Counting House" and rebranded. This audit covers six dimensions and produces a prioritized action plan.

**Overall Health: B+** — Solid core with known gaps in multi-tenancy, security hardening, customization, and polish.

| Dimension | Grade | Key Finding |
|-----------|-------|-------------|
| Database | A | 25/25 tables healthy, 2 missing triggers, **CH-specific CHECK constraints block any second customer** |
| API Coverage | A- | 68 routes, comprehensive CRUD, 2 missing UI pages |
| UI/UX | B+ | Strong theme, needs accessibility + empty states |
| Security | B- | Good fundamentals, 4 critical + 7 high issues |
| Code Quality | B | Solid patterns, needs cleanup (data-oid, branding, DRY) |
| Customization | C+ | Core entities configurable, many hardcoded enums |

---

## 1. DATABASE INTEGRITY

**Status: Healthy — with two customer blockers**

All 25 tables exist, all foreign keys are correct, all indexes are present, TypeScript types match 1:1.

### Issues

| Issue | Severity | Fix |
|-------|----------|-----|
| `checklist_templates` missing `updated_at` trigger | Low | Migration 025 |
| `event_checklist_items` missing `updated_at` trigger | Low | Migration 025 |
| `shipping_handler CHECK ('handler_a', 'handler_b')` — hardcoded CH employee names | **CUSTOMER BLOCKER** | Sprint 0: convert to configurable `app_settings` or `org_settings` |
| `notify_channel CHECK ('scrooge', 'in_app', 'both')` — old branding in DB constraint | **CUSTOMER BLOCKER** | Sprint 0: rename enum values, migration required |

---

## 2. SECURITY FINDINGS

### Critical (4)
1. **CSP allows `unsafe-eval`** — `next.config.ts` script-src includes `'unsafe-eval'`, defeating XSS protection
2. **Webhook SSRF logic bug** — Operator precedence bug in IP validation (`a === 169 && b === 254 ||` should group differently)
3. **In-memory rate limiting** — Login and upload rate limits don't persist across restarts or scale across instances
4. **API key entropy** — `randomBytes(24)` should be `randomBytes(32)` for 256-bit keys

### High (7)
1. **Idempotency caches error responses** — Failed requests with stack traces get cached and replayed
2. **Admin cleanup endpoint potential DoS** — No batch size limit, can lock DB
3. **Health endpoint no rate limit** — Public endpoint makes outbound requests to Supabase/OpenRouter
4. **SSRF missing IPv6 checks** — Webhook URL validation doesn't block IPv6 private ranges
5. **Cross-event access** — Checklist/team assignment handlers don't verify the item belongs to the URL's event_id
6. **Non-atomic bulk operations** — `expenses/bulk` and `import/brex/confirm` can partially fail with no rollback
7. **DOCX magic bytes insufficient** — Only validates ZIP header, not DOCX-specific content

### Medium (5)
1. Missing audit logging for login attempts and API key usage
2. Error messages reveal validation details on sensitive endpoints
3. No CORS headers explicitly configured
4. LIKE clause escaping works but isn't documented
5. Admin modal uses div overlay instead of dialog element

### Low (7)
- Env vars not validated at startup
- PDF parsing has no timeout
- No request ID tracking headers
- Service role key rotation not automated
- Admin routes lack dual-control confirmation
- Timezone documentation missing
- No X-Request-ID in responses

---

## 3. UI/UX FINDINGS

### High Priority
1. **Event detail tab bar doesn't scroll on mobile** — tabs overflow, need `overflow-x-auto`
2. **No empty states** for filtered list views returning zero results
3. **Toast missing `role="alert"`** — screen readers don't announce notifications
4. **ProgressBar missing ARIA attributes** — no `role="progressbar"`, `aria-valuenow`, `aria-valuemax`
5. **Form errors not linked to fields** — no `aria-describedby`

### Medium Priority
6. Button dark mode incomplete — success/accent variants missing dark overrides
7. Sidebar active state wrong for nested routes — `/settings/cadence` highlights both items
8. Light mode color contrast insufficient — muted text `#6B5F82` may fail WCAG AA
9. Form validation errors location unclear — no visible inline error rendering
10. Admin detail modal should use `<dialog>` element

### Low Priority
11. Skeleton loader colors hardcoded instead of CSS variables
12. No breadcrumb navigation for nested pages
13. Tab panels conditionally rendered vs hidden (accessibility)
14. No column sorting in admin log table
15. Responsive text sizes missing (`text-3xl` should be `text-2xl md:text-3xl`)

---

## 4. FUNCTIONALITY GAPS

### Missing UI Pages
| Feature | API Exists | DB Exists | UI Missing |
|---------|-----------|-----------|------------|
| Webhook management | Yes (full CRUD) | Yes | **No page** |
| Audit log viewer | Yes (GET) | Yes | **No page** (only error logs visible) |
| API key management | Yes (full CRUD) | Yes | **Unclear/embedded** |

### Hardcoded Values That Should Be Configurable
| Value | Current Location | Impact |
|-------|-----------------|--------|
| Event tiers | DB enum + TypeScript type | Users can't add custom tiers |
| Pipeline stages | DB CHECK constraint | Users can't customize workflow |
| Shipping handlers | DB CHECK (`'handler_a'`, `'handler_b'`) | **Hardcoded CH employee names — blocks any other customer** |
| Checklist phases | DB enum (`pre_event`, `day_of`, `post_event`) | Users can't add phases |
| Note types | DB CHECK constraint | Users can't add note categories |
| Notification channels | DB CHECK (`'scrooge'`, `'in_app'`, `'both'`) | **Old branding in DB constraint** |
| Expense sources | DB enum | Can't add new import sources |
| Fiscal year 2026 | Hardcoded in export page | Export breaks for other years |

### Missing Features (by priority)
1. **Full-text search** — No cross-entity search, limited field-specific filtering
2. **Bulk event operations** — No bulk edit/delete/status change for events
3. **Event template cloning** — Can't duplicate event setup from previous year
4. **Email/Slack notifications** — Only in-app and AI agent channels
5. **Budget forecasting** — No trend analysis or burn projections
6. **Saved filters/reports** — Filters reset on page reload, not in URL params
7. **Webhook triggers** — Infrastructure exists but mutations don't fire webhooks
8. **Event dependencies** — Can't link related events

---

## 5. REFACTORING OPPORTUNITIES

### High Priority
| Issue | Files | Effort |
|-------|-------|--------|
| **Remove all `data-oid` attributes** | Every JSX file | Low — bulk find/replace |
| **Update "The Firm" comments to "Ghostly"** | 12 API route files | Low |
| **Extract pagination utility** | 5 API routes with identical logic | Low |
| **Fix `as any` type casts** | 6+ files | Medium |

### Medium Priority
| Issue | Files | Effort |
|-------|-------|--------|
| Extract validation constants from `database.ts` | Multiple API routes | Low |
| Remove unused `EventType` enum | `database.ts` | Trivial |
| Create `useFiscalYearEventTypes()` hook | Multiple components | Medium |
| Migrate `console.error` to `logError()` | 10+ files | Medium |
| Extract relation extraction helper | 4+ API routes | Medium |

### Old Branding Still Present
- 12 API route files: `"The Firm - ..."` comments
- Migration comments: `"The Counting House"`, `"Scrooge AI agent"`
- MCP server: `countingHouseRequest()` function name
- Database enum: `'scrooge'` in `notify_channel`
- TypeScript: `NotifyChannel = 'scrooge' | 'in_app' | 'both'`
- Docs: Multiple plan files reference old names
- File: `PRD-Coutning-House_event-Piplein.md` (typo in filename)

---

## 6. BUILT-IN AGENT — FULL DESIGN

### Goal
An embedded AI agent that is nearly as capable as an OpenClaw agent — with a heartbeat, cron scheduling, Google Workspace integration, Slack integration, and a persistent chat UI. This is Ghostly's primary product moat. No other event management platform ships this.

### Licensing — Commercial Use is Clear
All recommended libraries below are **MIT or Apache 2.0 licensed**. Both are safe for a commercial SaaS product — you can sell Ghostly without open-sourcing your own code. The one constraint: include the copyright notice for each library in your `/legal` page or `package.json`.

**Avoid:** AGPL (requires open-sourcing your app if served as a SaaS) and GPL (viral license that forces derivative works open). None of the recommended stack uses either.

### Why Not Fork an Agent Framework
LangChain, AutoGen, CrewAI, and LangGraph are all **Python-first**. Ghostly is Next.js on Railway. Bolting a Python agent runtime onto this stack adds operational complexity, a second language to maintain, and a second service to keep alive. It's also overkill — an event management agent doesn't need a multi-agent orchestration framework. Build native.

### Recommended Stack

| Package | License | Role |
|---------|---------|------|
| `ai` (Vercel AI SDK) | MIT | Foundation — streaming, tool calls, multi-step agent loops, memory. Native Next.js. |
| `trigger.dev` | Apache 2.0 | Heartbeat + cron. Scheduled jobs in TypeScript, runs alongside your app. Self-hostable on Railway. |
| `assistant-ui` | MIT | React chat component library — drop-in panel, streaming, tool call display, message history. |
| `@anthropic-ai/sdk` | MIT | Direct Anthropic access via Vercel AI SDK provider |
| `googleapis` | Apache 2.0 | Google Calendar, Gmail, Drive, Sheets |
| `@slack/web-api` | MIT | Slack posting, DMs, channel management |

Replace `src/lib/openrouter.ts` with Vercel AI SDK. Same Anthropic access, vastly better streaming and tool-use ergonomics.

### Architecture

```
Ghostly Agent
├── UI: assistant-ui chat panel (persistent, collapsible, in AppShell)
│
├── API Routes:
│   ├── POST /api/agent/chat        (streaming, Vercel AI SDK)
│   └── POST /api/agent/heartbeat   (called by Trigger.dev cron)
│
├── Tools (Claude tool_use via Vercel AI SDK):
│   ├── Ghostly tools:
│   │   get_events, get_event_detail, update_budget,
│   │   create_checklist_item, add_attendee, flag_risk,
│   │   get_overdue_tasks, get_over_budget_events
│   ├── Google tools:
│   │   get_calendar_events, send_email,
│   │   create_drive_doc, read_sheet, update_sheet
│   ├── Slack tools:
│   │   post_to_channel, send_dm, create_channel
│   └── Web tools:
│       search_web, fetch_page  (venue research, vendor lookup)
│
├── Memory: pgvector in existing Supabase DB
│   Stores: conversation history, past decisions, event context
│   Schema: agent_memories table (org_id, event_id nullable,
│           embedding vector(1536), content, metadata jsonb)
│
├── Heartbeat (Trigger.dev cron, daily at 7 AM per org timezone):
│   - Query events in next 30 / 14 / 7 / 2 days
│   - Flag overdue checklist tasks
│   - Flag over-budget line items
│   - Post digest to Slack or in-app notification
│   - Write heartbeat summary to agent_memories
│
└── Config: Per-org agent_settings table
    - connected_integrations (Google, Slack, etc.)
    - notification_channel ('slack' | 'in_app' | 'email')
    - heartbeat_enabled (bool)
    - heartbeat_time (time, org timezone)
    - agent_name (org can rename their agent)
    - agent_focus (freetext system prompt addendum)
```

### Capability Comparison

| Capability | OpenClaw | Ghostly Agent |
|------------|----------|---------------|
| LLM brain | Claude | Claude (same) |
| Tool use | ✅ | ✅ |
| Streaming responses | ✅ | ✅ (Vercel AI SDK) |
| Memory / RAG | ✅ | ✅ (pgvector in Supabase) |
| Heartbeat | ✅ | ✅ (Trigger.dev) |
| Cron scheduling | ✅ | ✅ (Trigger.dev) |
| Google Workspace | ✅ | ✅ |
| Slack | ✅ | ✅ |
| Web search | ✅ | ✅ |
| Multi-user / org-scoped | ✅ | ✅ (after Sprint 0) |
| Self-hosted | ✅ | ✅ (Railway) |

### What Already Exists in Codebase
- `src/lib/openrouter.ts` — replace with Vercel AI SDK (same Anthropic access, better DX)
- `mcp-server/src/index.ts` — MCP tool definitions, port directly to Vercel AI SDK tool format
- `withApiHandler` pattern — reuse for `/api/agent/chat` and `/api/agent/heartbeat`
- All internal Ghostly API routes — agent calls the same endpoints as the frontend

### What Needs Building
- `agent_memories` table (pgvector, org-scoped)
- `agent_settings` table (per-org config)
- `chat_sessions` + `chat_messages` tables (org + user scoped)
- `POST /api/agent/chat` — streaming, tool execution loop, memory read/write
- `POST /api/agent/heartbeat` — Trigger.dev job, event scanning, notification dispatch
- Google OAuth flow for per-org Google Workspace connection
- Slack OAuth flow (or webhook URL config) for per-org Slack connection
- `assistant-ui` chat panel integration into AppShell
- Per-org agent settings UI page

### Estimated Scope: ~5-7 days of implementation

---

## 7. PRIORITIZED ACTION PLAN

> **NOTE:** Sprint order has been revised from the original audit. Multi-tenancy (Sprint 0) must come first — it restructures the DB schema and auth layer that every other sprint builds on. The original sprints are renumbered accordingly.

---

### ⚡ Sprint 0: Multi-Tenancy + Supabase Auth + Google OAuth (3-4 days)

**Why first:** The app currently runs on a single service_role key with no user concept. There is no `users` table, no session management, and no organization isolation. Every other sprint's work (RLS, audit logging, rate limiting, configurable enums) depends on knowing *who* is making a request and *which org* they belong to. Building any of this without Sprint 0 means rewriting it all again.

**Architecture:**

```
organizations            users (via Supabase Auth)
─────────────            ──────────────────────────
id (uuid, PK)            id (uuid = auth.uid())
name                     email
slug                     created_at
plan_tier                ↕ (via organization_members)
created_at
                         organization_members
                         ──────────────────────
                         org_id → organizations.id
                         user_id → auth.users.id
                         role: 'owner' | 'admin' | 'member'
                         invited_at
                         accepted_at
```

**Tasks:**

**Database — Migration 026:**
- [ ] Create `organizations` table (id, name, slug, plan_tier, settings jsonb, created_at)
- [ ] Create `organization_members` table (org_id, user_id, role, invited_at, accepted_at)
- [ ] Add `organization_id uuid NOT NULL REFERENCES organizations(id)` to ALL 25 data tables
- [ ] Add indexes on `organization_id` for all 25 tables
- [ ] Remove `shipping_handler CHECK ('handler_a', 'handler_b')` — replace with `org_settings` JSONB or configurable table
- [ ] Remove `notify_channel CHECK ('scrooge', ...)` — rename `'scrooge'` → `'agent'` in enum migration
- [ ] Enable Supabase RLS on all tables (if not already done) with `organization_id = (SELECT org_id FROM organization_members WHERE user_id = auth.uid())` policies
- [ ] Migration 027: Add missing `updated_at` triggers for `checklist_templates` and `event_checklist_items` (fold into this sprint)

**Auth — Replace `src/lib/auth.ts`:**
- [ ] Enable Supabase Auth in Supabase dashboard
- [ ] Enable Google OAuth provider (requires Google Cloud project OAuth credentials)
- [ ] Enable Email magic link as fallback provider
- [ ] Replace `src/lib/auth.ts` with Supabase Auth session handling (`createServerClient` from `@supabase/ssr`)
- [ ] Update `src/middleware.ts` to use Supabase Auth session refresh pattern
- [ ] Remove hardcoded service_role auth from API route checks — replace with `auth.uid()` + org membership verification
- [ ] Update `src/lib/api-helpers.ts` `withApiHandler` to extract `user_id` and `organization_id` from Supabase session and inject into request context

**Onboarding Flow:**
- [ ] `/auth/login` — Google OAuth button + magic link fallback
- [ ] `/auth/callback` — Supabase OAuth callback handler
- [ ] `/onboarding` — new org creation (name, slug) for first-time users
- [ ] `/invite/[token]` — accept org invite (creates `organization_members` row)
- [ ] Org settings page: invite members by email, manage roles (owner/admin/member)

**Data Seeding:**
- [ ] Wrap existing data in a default `organization_id` for the current single deployment (so existing data doesn't break)

---

### Sprint 1: CH-Specific Hardcoding Removal & Branding Cleanup (1 day)

**Why before security fixes:** These are customer blockers. Any org onboarded before this is broken.

- [ ] Remove `data-oid` attributes from all JSX files (bulk find/replace)
- [ ] Update all `"The Firm - ..."` comments in 12 API route files to `"Ghostly - ..."`
- [ ] Rename `countingHouseRequest()` in MCP server to `ghostlyRequest()`
- [ ] Update `NotifyChannel` TypeScript type: `'scrooge'` → `'agent'`
- [ ] Fix hardcoded `fiscalYear = 2026` in export page — derive from current year or org settings
- [ ] Delete `PRD-Coutning-House_event-Piplein.md` (typo filename, old branding)
- [ ] Remove unused `EventType` enum from `database.ts`

---

### Sprint 2: Critical Security Fixes (1-2 days)

- [ ] Remove `'unsafe-eval'` from CSP in `next.config.ts`
- [ ] Fix webhook SSRF operator precedence bug — wrap condition in parentheses: `(a === 169 && b === 254)`
- [ ] Fix cross-event + cross-org access in checklist/team handlers — verify `event_id` belongs to requesting user's `organization_id`
- [ ] Increase API key entropy: `randomBytes(24)` → `randomBytes(32)`
- [ ] Fix idempotency to only cache successful (2xx) responses
- [ ] Add batch size limit to admin cleanup endpoint (e.g., max 500 rows/request)
- [ ] Add rate limiting to health endpoint
- [ ] Add IPv6 private range checks to webhook SSRF protection

---

### Sprint 3: Accessibility & UI Polish (1-2 days)

- [ ] Add `role="alert"` + `aria-live="polite"` to Toast component
- [ ] Add `role="progressbar"` + `aria-valuenow/max` to ProgressBar
- [ ] Add `overflow-x-auto` to event detail tab bar (mobile fix)
- [ ] Create shared `EmptyState` component, add to all list views
- [ ] Fix sidebar active state matching for nested routes
- [ ] Add `aria-describedby` linking form errors to inputs
- [ ] Fix button dark mode for success/accent variants
- [ ] Replace admin div overlay with `<dialog>` element
- [ ] Fix light mode muted text contrast (`#6B5F82` → ensure WCAG AA compliance)

---

### Sprint 4: Customization & Missing Pages (2-3 days)

- [ ] Build Webhooks management page (CRUD UI for existing API)
- [ ] Build Audit Log viewer page (read-only, scoped to current org)
- [ ] Make shipping handlers configurable per org (new `org_settings` JSONB field or `org_config` table)
- [ ] Make pipeline stages configurable per org (new table, migrate from CHECK constraint)
- [ ] Make event tiers configurable per org (new table, migrate from DB enum)
- [ ] Extract pagination utility to shared function (5 API routes with identical logic)
- [ ] Extract validation constants from `database.ts`
- [ ] Persist filter state in URL search params

---

### Sprint 5: Security Hardening (1-2 days)

- [ ] Migrate rate limiting to database-backed (Supabase table, org-scoped)
- [ ] Add batch size limits to bulk operations (`expenses/bulk`, `import/brex/confirm`) with DB transactions for atomicity
- [ ] Add audit logging for login attempts and API key usage (org-scoped `audit_log` table)
- [ ] Add startup env var validation
- [ ] Add IPv6 private range checks to webhook SSRF protection
- [ ] Add `X-Request-ID` tracking headers
- [ ] Add PDF parsing timeout

---

### Sprint 6: Feature Enhancements (2-3 days)

- [ ] Full-text search across events + expenses (Supabase `to_tsvector`, org-scoped)
- [ ] Bulk event operations (status change, delete) — org-scoped, with confirmation
- [ ] Event template cloning (duplicate from previous year)
- [ ] Make checklist phases configurable per org
- [ ] Make note types configurable per org
- [ ] Saved filter presets persisted in URL search params

---

### Sprint 7: Built-in Agent (5-7 days)

**This is the product moat.** No other event management platform ships an embedded AI agent with heartbeat, cron, Google Workspace, and Slack. See Section 6 for full design.

**Foundation:**
- [ ] Install: `ai` (Vercel AI SDK), `@ai-sdk/anthropic`, `trigger.dev`, `assistant-ui`, `googleapis`, `@slack/web-api`
- [ ] Replace `src/lib/openrouter.ts` with Vercel AI SDK Anthropic provider
- [ ] Port MCP tool definitions from `mcp-server/src/index.ts` to Vercel AI SDK `tool()` format

**Database — Migration 028:**
- [ ] `agent_memories` table (id, org_id, user_id, event_id nullable, embedding vector(1536), content text, metadata jsonb, created_at) — enable pgvector extension in Supabase
- [ ] `agent_settings` table (org_id PK, agent_name, agent_focus, heartbeat_enabled, heartbeat_time, notification_channel, connected_integrations jsonb)
- [ ] `chat_sessions` table (id, org_id, user_id, event_id nullable, title, created_at)
- [ ] `chat_messages` table (id, session_id, role, content, tool_calls jsonb, created_at)
- [ ] RLS on all four tables: scoped to `organization_id`

**API Routes:**
- [ ] `POST /api/agent/chat` — streaming via Vercel AI SDK `streamText()`, multi-step tool execution loop, memory read/write, page context injection
- [ ] `GET /api/agent/sessions` — list chat sessions for current user+org
- [ ] `POST /api/agent/heartbeat` — Trigger.dev scheduled job: scan events (30/14/7/2 days out), flag overdue tasks and over-budget items, dispatch Slack or in-app notification, write summary to `agent_memories`

**Tools to implement:**
- [ ] Ghostly tools: `get_events`, `get_event_detail`, `update_budget`, `create_checklist_item`, `add_attendee`, `flag_risk`, `get_overdue_tasks`, `get_over_budget_events`
- [ ] Google tools: `get_calendar_events`, `send_email`, `create_drive_doc`, `read_sheet`
- [ ] Slack tools: `post_to_channel`, `send_dm`
- [ ] Web tools: `search_web`, `fetch_page`

**Integrations:**
- [ ] Google OAuth flow (per-org) — store refresh token in `agent_settings.connected_integrations`
- [ ] Slack OAuth flow (per-org) — store bot token in `agent_settings.connected_integrations`

**UI:**
- [ ] Install and configure `assistant-ui` — streaming chat panel, tool call result display, message history
- [ ] Integrate chat panel into AppShell (collapsible slide-out, accessible from any page)
- [ ] Agent settings page — toggle integrations, set heartbeat time, rename agent, set focus prompt
- [ ] Chat trigger button in AppShell nav

**Trigger.dev setup:**
- [ ] Self-host Trigger.dev worker on Railway (separate service) OR use Trigger.dev cloud
- [ ] Define `ghostly-heartbeat` job: scheduled, per-org, respects `heartbeat_time` and timezone

---

### Future Sprints
- Email/Slack notification channels (org-configurable)
- Webhook trigger execution on mutations (fire on create/update/delete events)
- Budget forecasting and trend analysis
- Saved report templates
- Event dependencies and linking
- Billing / plan enforcement (if moving to SaaS)
- Monday.com integration

---

## Appendix: File Reference

| Category | Key Files |
|----------|-----------|
| Auth | `src/lib/auth.ts`, `src/middleware.ts` |
| API Helpers | `src/lib/api-helpers.ts`, `src/lib/permissions.ts` |
| Database Types | `src/types/database.ts` |
| Theme | `src/app/globals.css`, `tailwind.config.js` |
| Layout | `src/components/layout/AppShell.tsx` |
| UI Components | `src/components/ui/Button.tsx`, `Card.tsx`, `Toast.tsx`, `ProgressBar.tsx`, `ConfirmDialog.tsx` |
| Migrations | `supabase/migrations/001-024` |
| MCP Server | `mcp-server/src/index.ts` |
| Config | `next.config.ts`, `.env.local`, `.mcp.json` |
