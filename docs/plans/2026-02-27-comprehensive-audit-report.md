# Ghostly Comprehensive Audit Report

**Date:** 2026-02-27
**Scope:** Full codebase audit — UI/UX, functionality, security, refactoring, database integrity, and feature planning

---

## Executive Summary

Ghostly is a mature Next.js 16 event management and budget tracking platform with 16 pages, 68 API routes, and 25 database tables. The app was recently forked from "The Counting House" and rebranded. This audit covers six dimensions and produces a prioritized action plan.

**Overall Health: B+** — Solid core with known gaps in security hardening, customization, and polish.

| Dimension | Grade | Key Finding |
|-----------|-------|-------------|
| Database | A | 25/25 tables healthy, 2 missing triggers |
| API Coverage | A- | 68 routes, comprehensive CRUD, 2 missing UI pages |
| UI/UX | B+ | Strong theme, needs accessibility + empty states |
| Security | B- | Good fundamentals, 4 critical + 7 high issues |
| Code Quality | B | Solid patterns, needs cleanup (data-oid, branding, DRY) |
| Customization | C+ | Core entities configurable, many hardcoded enums |

---

## 1. DATABASE INTEGRITY

**Status: Healthy**

All 25 tables exist, all foreign keys are correct, all indexes are present, TypeScript types match 1:1.

### Issues (2)

| Issue | Severity | Fix |
|-------|----------|-----|
| `checklist_templates` missing `updated_at` trigger | Low | New migration 025 |
| `event_checklist_items` missing `updated_at` trigger | Low | New migration 025 |

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
| Shipping handlers | DB CHECK (`'handler_a'`, `'handler_b'`) | Hardcoded employee names |
| Checklist phases | DB enum (`pre_event`, `day_of`, `post_event`) | Users can't add phases |
| Note types | DB CHECK constraint | Users can't add note categories |
| Notification channels | DB CHECK (`'scrooge'`, `'in_app'`, `'both'`) | Old branding in DB |
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

## 6. BUILT-IN CHAT/AGENT FEATURE — DESIGN CONCEPT

### Architecture

The app already has the foundations for an embedded agent:
- **MCP server** at `mcp-server/` provides 12+ tools for event/expense management
- **OpenRouter integration** at `src/lib/openrouter.ts` handles LLM API calls
- **API key auth** supports agent-to-API communication
- **Webhook system** can deliver events to an agent

### Proposed Implementation

```
┌─────────────────────────────────────┐
│  Ghostly UI                         │
│  ┌───────────────────────────────┐  │
│  │  Chat Panel (slide-out)       │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Message history         │  │  │
│  │  │ (stored in Supabase)    │  │  │
│  │  ├─────────────────────────┤  │  │
│  │  │ Input + Send            │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │ POST /api/chat
               ▼
┌─────────────────────────────────────┐
│  Chat API Route                     │
│  - Receives user message            │
│  - Builds system prompt with        │
│    current page context             │
│  - Calls OpenRouter with tools      │
│  - Executes tool calls against      │
│    internal API routes              │
│  - Streams response back            │
└─────────────────────────────────────┘
```

### Key Components Needed

1. **Database: `chat_sessions` + `chat_messages` tables** — Store conversation history
2. **API: `POST /api/chat`** — Accept message, call LLM with tool definitions, return streamed response
3. **API: `GET /api/chat/sessions`** — List/manage chat sessions
4. **UI: `ChatPanel` component** — Slide-out panel accessible from any page
5. **UI: `ChatMessage` component** — Render messages with markdown + tool call results
6. **System prompt** — Define agent personality, available tools, and current context
7. **Tool definitions** — Map MCP tools to OpenRouter function calling format

### What Already Exists
- OpenRouter client (`src/lib/openrouter.ts`) — needs streaming support added
- API route pattern (`withApiHandler`) — reusable for chat endpoint
- MCP tool definitions (`mcp-server/src/index.ts`) — tool schemas already defined
- All internal APIs — agent calls the same endpoints as the MCP server

### What Needs Building
- Chat UI components (panel, messages, input)
- Chat API route with tool execution loop
- Database tables for session/message persistence
- Streaming response support (SSE or WebSocket)
- Context injection (current page, selected event, etc.)

### Estimated Scope: ~3-4 days of implementation

---

## 7. PRIORITIZED ACTION PLAN

### Sprint 1: Critical Fixes & Cleanup (1-2 days)

**Security:**
- [ ] Remove `'unsafe-eval'` from CSP in `next.config.ts`
- [ ] Fix webhook SSRF operator precedence bug
- [ ] Fix cross-event access in checklist/team handlers (verify event_id ownership)
- [ ] Increase API key entropy to 32 bytes

**Database:**
- [ ] Migration 025: Add missing `updated_at` triggers for `checklist_templates` and `event_checklist_items`

**Cleanup:**
- [ ] Remove all `data-oid` attributes from JSX (bulk operation)
- [ ] Update "The Firm" comments to "Ghostly" in 12 API files
- [ ] Fix hardcoded `fiscalYear = 2026` in export page

### Sprint 2: Accessibility & UI Polish (1-2 days)

- [ ] Add `role="alert"` + `aria-live="polite"` to Toast component
- [ ] Add `role="progressbar"` + `aria-valuenow/max` to ProgressBar
- [ ] Add `overflow-x-auto` to event detail tab bar
- [ ] Create shared EmptyState component, add to all list views
- [ ] Fix sidebar active state matching for nested routes
- [ ] Add `aria-describedby` linking form errors to inputs
- [ ] Fix button dark mode for success/accent variants

### Sprint 3: Customization & Missing Pages (2-3 days)

- [ ] Build Webhooks management page (CRUD UI for existing API)
- [ ] Build Audit Log viewer page (read-only UI for existing API)
- [ ] Make shipping handlers configurable (new settings table or app_settings)
- [ ] Extract pagination utility to shared function
- [ ] Extract validation constants from database.ts
- [ ] Persist filter state in URL search params

### Sprint 4: Security Hardening (1-2 days)

- [ ] Migrate rate limiting to database-backed (Supabase table)
- [ ] Only cache successful responses in idempotency system
- [ ] Add batch size limits to admin cleanup endpoint
- [ ] Add rate limiting to health endpoint
- [ ] Add IPv6 private range checks to webhook SSRF protection
- [ ] Add startup env var validation
- [ ] Add audit logging for login attempts

### Sprint 5: Feature Enhancements (2-3 days)

- [ ] Full-text search across events + expenses
- [ ] Bulk event operations (status change, delete)
- [ ] Make event tiers configurable (new table, migrate from enum)
- [ ] Make pipeline stages configurable (new table, migrate from CHECK)
- [ ] Event template cloning (duplicate from previous year)

### Sprint 6: Built-in Chat Agent (3-4 days)

- [ ] Design chat database schema (sessions, messages)
- [ ] Build chat API route with tool execution
- [ ] Build ChatPanel UI component
- [ ] Add streaming response support
- [ ] Integrate page context into system prompt
- [ ] Add chat trigger button to AppShell

### Future Sprints

- Email/Slack notification channels
- Webhook trigger execution on mutations
- Budget forecasting and trend analysis
- Saved filter presets and report templates
- Event dependencies and linking
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
