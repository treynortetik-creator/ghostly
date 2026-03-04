# Ghostly Comprehensive Codebase Review

**Date:** 2026-03-03
**Scope:** Full codebase — 296 source files, 38 migrations, all configs
**Stack:** Next.js 16.1, Supabase (Postgres + RLS), Railway, Tailwind v4, OpenRouter AI

---

## Executive Summary

Ghostly is a well-architected event management SaaS with solid fundamentals — org-scoped queries, middleware auth enforcement, API key hashing, HMAC-signed webhooks, and defense-in-depth RLS. The codebase is clearly written by engineers who care about correctness.

The review uncovered **1 critical security issue** (unauthenticated endpoint), **1 critical UI issue** (broken Tailwind v4 syntax across 24 files), and a cluster of high-priority items around file storage (ephemeral filesystem on Railway), missing error boundaries, incomplete Database types (`as any` casts), and cross-tenant webhook leakage. The feature gap analysis identified org management UI and agent tool coverage as the largest functional holes.

**Findings by severity across all 6 reviews:**

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 33 |
| Medium | 43 |
| Low | 31 |
| Info | 12 |

---

## CRITICAL (Fix Immediately)

### CRIT-1: Slack Digest Endpoint Open Without `CRON_SECRET`
**Source:** Security
**File:** `src/app/api/integrations/slack/digest/route.ts:14-18`

The auth guard is `if (cronSecret && ...)` — if `CRON_SECRET` is unset, the condition short-circuits and **any unauthenticated caller** can trigger digest delivery to all Slack workspaces for all organizations.

**Fix (1 line):**
```typescript
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

### CRIT-2: Tailwind v4 `placeholder-*` Syntax Broken (24 Files)
**Source:** UI/UX
**Files:** `ExpenseForm.tsx`, `ContactForm.tsx`, `TeamMemberForm.tsx`, `ExpenseFilters.tsx`, `EventTypeForm.tsx`, `contacts/page.tsx`, `admin/audit/page.tsx`, `webhooks/page.tsx`, `settings/cadence/page.tsx`, ~15 more

Tailwind v4 replaced `placeholder-*` with `placeholder:*` variant syntax. All instances of `placeholder-muted-foreground/50` generate **zero CSS** — placeholder text renders in browser default color.

**Fix:** Global find-and-replace:
```
placeholder-muted-foreground/50  ->  placeholder:text-muted-foreground/50
```

---

### CRIT-3: `focus:border-transparent` Removes Keyboard Focus Indicator (15 Inputs)
**Source:** UI/UX
**Files:** `ContactForm.tsx`, `TeamMemberForm.tsx` (5 inputs)

The ring is `ring-spectral` which blends into the purple-tinted card backgrounds, making focus nearly invisible to keyboard users. WCAG 2.4.7 violation.

**Fix:** Use the pattern from `EventForm.tsx`:
```
focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral focus:ring-offset-1 focus:ring-offset-background
```

---

## HIGH PRIORITY

### Security

| # | Finding | File | Effort |
|---|---------|------|--------|
| S-1 | `xlsx` 0.18.5 has prototype pollution CVE (GHSA-4r6h-8v6p-xvw6) — replace with `exceljs` | `package.json` | Medium |
| S-2 | CSP `connect-src 'self'` blocks Supabase Auth browser calls | `next.config.ts:24` | Small |
| S-3 | Internal worker auth bypass (`CRON_SECRET`) grants full admin to ANY route + ANY org | `middleware.ts:380-393` | Medium |
| S-4 | Missing `organization_id` filter on expense queries in event detail route | `api/events/[id]/route.ts:46` | Small |
| S-5 | No rate limiting on agent chat endpoint (most expensive operation) | `api/agent/chat/route.ts` | Small |
| S-6 | CSP `script-src 'unsafe-inline'` disables XSS protection benefit | `next.config.ts:20` | Medium |

### Production Readiness

| # | Finding | File | Effort |
|---|---------|------|--------|
| P-1 | **Local disk file storage — Railway wipes on every deploy** | `api/documents/route.ts:311` | Large |
| P-2 | No `Dockerfile`, `railway.toml`, or infra-as-code | Root directory | Small |
| P-3 | Missing env vars in `.env.example` (`CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, etc.) | `.env.example` | Small |
| P-4 | No global error boundary (`error.tsx`, `global-error.tsx`, `not-found.tsx`) | `src/app/` | Small |
| P-5 | No retry logic on OpenRouter or webhook delivery calls | `openrouter.ts`, `webhook-sender.ts` | Medium |
| P-6 | No external error tracking (Sentry, etc.) | Entire codebase | Small |
| P-7 | Agent chat accepts unlimited message size — OOM risk | `api/agent/chat/route.ts:184` | Small |
| P-8 | Export endpoints fetch entire org dataset — OOM/timeout at scale | `api/export/excel/route.ts:54` | Medium |
| P-9 | Health check calls OpenRouter on every poll (wastes quota) | `api/health/route.ts:79` | Small |

### Code Quality

| # | Finding | File | Effort |
|---|---------|------|--------|
| Q-1 | Webhook sender missing `organization_id` filter — cross-tenant leakage | `webhook-sender.ts:27` | Small |
| Q-2 | Agent worker creates 9N redundant Supabase clients per run | `agent/worker.ts` | Medium |
| Q-3 | 29 `supabase as any` casts — agent tables missing from `Database` type | `agent/runtime.ts`, `worker.ts`, `memory.ts` | Medium |
| Q-4 | `AGENT_MODEL` / `OPENROUTER_API_URL` duplicated across 7 files | Multiple | Small |

### Refactoring

| # | Finding | File | Effort |
|---|---------|------|--------|
| R-1 | OpenRouter fetch logic duplicated in 6 files — `openrouter.ts` wrapper unused | 6 files | Medium |
| R-2 | `getUploadBasePath()` defined identically in 4 places | 4 files | Small |
| R-3 | API key validation duplicated between middleware and `auth.ts` | `middleware.ts`, `auth.ts` | Small |
| R-4 | PGRST116 404 check pattern repeated 20+ times across 14 files | 14 files | Small |

### UI/UX

| # | Finding | File | Effort |
|---|---------|------|--------|
| U-1 | Hardcoded "FY 2026" in 5+ pages — will be wrong next year | `events/page.tsx`, `expenses/page.tsx`, etc. | Small |
| U-2 | Event delete uses ad-hoc inline confirm instead of existing `ConfirmDialog` | `events/[id]/page.tsx:459` | Small |
| U-3 | Toast `role="alert"` used for all types (success should be `role="status"`) | `Toast.tsx` | Small |
| U-4 | `ConfirmDialog` returns `null` when closed, preventing native `<dialog>` cleanup | `ConfirmDialog.tsx:40` | Small |

### Feature Gaps

| # | Finding | Status |
|---|---------|--------|
| F-1 | **No organization management UI** — no create/switch/invite members | No UI exists |
| F-2 | Agent Slack/Email notification channels are stubs ("coming soon") | Selectable but non-functional |
| F-3 | Event-Contacts linking — DB table exists, no API route or UI | Dead from UI/API side |
| F-4 | Agent tool coverage gaps — contacts, notes, shipments, expense CRUD all missing | APIs exist, tools don't |
| F-5 | Document storage uses local filesystem (cloud-incompatible) | Same as P-1 |
| F-6 | No user profile / account settings page | Org settings only |

---

## MEDIUM PRIORITY

### Security (Medium)

- Slack OAuth `error` param reflected unencoded into redirect URL (`slack/oauth/callback`)
- Document download trusts `mime_type` from DB as `Content-Type` — could serve HTML
- In-memory upload rate limiter ineffective under horizontal scaling (`documents/route.ts:47`)
- Prompt injection risk via user-customizable `system_prompt_template` (12k chars)
- `ghostly-active-org` cookie is not `httpOnly` — exposed to JavaScript (intentional but risky)
- No rate limiting on API key creation
- No rate limit on public waitlist endpoint

### Production Readiness (Medium)

- Missing database indexes on `chat_sessions.updated_at`, `events.created_at`
- Board/calendar views load entire expense table (unbounded queries)
- No circuit breaker or per-call timeout for OpenRouter
- In-memory upload rate limiter won't scale across instances
- SSE chat streaming has no backpressure or connection limit
- No structured logging format (inconsistent `console.error` vs `logError`)
- No API documentation (OpenAPI spec or similar)
- No data retention policy for audit logs, agent memories, chat messages
- `AUTH_PASSWORD` stored in plaintext env var (single-tenant auth)
- Public landing page has no privacy policy or terms of service

### Code Quality (Medium)

- `idempotency.ts` TOCTOU race window between expiry check and handler execution
- `vitest.config.ts` excludes `.test.tsx` files from test runs
- In-memory error logger array not serverless-safe (`error-logger.ts:24`)
- CSP `connect-src 'self'` blocks future Supabase realtime subscriptions
- Redundant JavaScript sort after DB-ordered pagination (`events/route.ts:185`)
- `escapeLikePattern` defined in 3 places
- JWT minting logic duplicated between middleware and `auth.ts`
- `DEFAULT_ORG_ID` hardcoded inside function body on every request

### Refactoring (Medium)

- `ChatPanel.tsx` is a 1076-line god component — needs extraction
- Memory injection logic duplicated between chat route and runtime
- `Record<string, unknown>` overuse for agent settings (no typed DB row)
- Allowed file types defined in 3 places
- `AUTH_COOKIE_NAME` defined twice + 1 literal usage
- JSON markdown stripping duplicated between routes and `openrouter.ts`
- Silent `.catch(() => {})` swallows errors on budget alerts and document summarization

### UI/UX (Medium)

- Loading button state not communicated to screen readers (`aria-busy` missing)
- 10-tab event detail bar overflows on mobile with no scroll indicator
- Nav section collapse buttons missing `aria-expanded`
- Sidebar tooltip spans not hidden from a11y tree (`aria-hidden` missing)
- `--mist` dark mode value (#6B5F82) fails WCAG AA contrast for normal text (~3.6:1)
- `.stagger-children` animation hardcoded to 8 items max
- Chat panel resize handle too narrow (6px — should be 8-12px)
- Slack channel picker combobox missing all ARIA attributes
- Mobile sidebar has no focus trap in open state
- Per-page `useToast()` instances cause toast loss on navigation

### Feature Gaps (Medium)

- Reminder system partially wired (manual reminders never auto-surfaced)
- Dashboard missing drill-down and alert widgets
- Agent cron/heartbeat ignores `autonomy_mode` setting (always runs with write tools)
- No events/contacts/team export (only expenses)
- Onboarding doesn't handle returning multi-org users
- Document versioning absent
- Saved filter presets not persisted to backend
- Webhook event types don't cover agent actions
- No bulk import for contacts or team members

---

## LOW PRIORITY

### Security (Low)

- Legacy auth is single shared credential for all orgs
- `x-forwarded-for` IP extraction inconsistent between routes
- Agent memory stores user messages without filtering (intra-org stored prompt injection)
- Error logger stores cross-org stack traces without org scoping

### Code Quality (Low)

- `parseBrexDate` doesn't validate impossible dates (Feb 30)
- JWT `TOKEN_EXPIRATION` string and cookie `maxAge` can drift independently
- Health endpoint `startedAt` resets on module re-evaluation
- Dual pagination systems on events endpoint (`page` and `offset`)
- Default fiscal year hardcoded to `2026` in export route
- `AUTH_COOKIE_NAME` re-declared in middleware (Edge constraint)
- Slack notifications make 3 sequential DB round-trips per notification
- Agent memory silently swallows all embedding errors (zero logging)
- Migration 001 references "The Counting House" — stale branding
- Agent worker processes orgs sequentially (could parallelize)

### Refactoring (Low)

- `randomId()` vs inline `Math.random()` — two implementations of same thing
- `error instanceof Error ? error.message : String(error)` repeated 11+ times
- Deprecated `substr` used in `error-logger.ts`
- `withIdempotency` inconsistently applied across POST routes
- 44 `console.error` calls bypass centralized `logError`
- `await createClient()` on a sync function (misleading, 20+ call sites)

### UI/UX (Low)

- `text-[10px]` used 26 times — below WCAG minimum readable size
- `CardTitle` hardcoded as `<h3>` regardless of heading hierarchy
- `ButtonGroup` missing `role="group"`
- Password field in login page uses `User` icon instead of `Lock` icon
- `OrgSwitcher` dropdown missing `aria-expanded` and Escape key handling
- Chat session list items use `<div onClick>` instead of `<button>`
- `FloatingDock` hidden indicator is `<div onClick>` not `<button>`
- Search command missing ARIA combobox pattern
- Clone dialog is inline on page, not a proper modal

### Feature Gaps (Low)

- Legacy `event_type` enum not cleaned up (dual-state in DB and types)
- No calendar export (iCal/Google Calendar)
- No super-admin multi-org management UI
- Agent memory embedding degrades silently (no health indicator)
- Contacts missing pagination and sort
- Team members missing search and pagination

---

## Top 10 Priority Fixes

| # | What | Why | Effort |
|---|------|-----|--------|
| 1 | Fix CRIT-1: Slack digest auth bypass | Unauthenticated endpoint in production | 1 line |
| 2 | Fix CRIT-2: Tailwind placeholder syntax | Broken styling across 24 files | Find-replace |
| 3 | Add `organization_id` to webhook sender | Cross-tenant webhook leakage | Small |
| 4 | Migrate file storage to Supabase Storage | Every Railway deploy deletes all documents | Large |
| 5 | Fix CSP `connect-src` for Supabase | OAuth may silently break in some browsers | Small |
| 6 | Add global `error.tsx` + `not-found.tsx` | Uncaught errors show blank/default pages | Small |
| 7 | Generate DB types, remove `as any` casts | 29 type-unsafe queries in agent subsystem | Medium |
| 8 | Rate limit agent chat endpoint | Most expensive operation has no throttle | Small |
| 9 | Add agent chat message size limit | Unbounded input → OOM risk | Small |
| 10 | Add `railway.toml` with health check | No infra-as-code for deployment target | Small |

---

## Quick Wins (< 30 min total)

1. Fix CRIT-1: Invert `cronSecret` guard (1 line)
2. Fix login password icon: `User` → `Lock` in `login/page.tsx:246`
3. Add `aria-expanded` to sidebar section buttons in `AppShell.tsx`
4. Replace event delete inline confirm with existing `ConfirmDialog`
5. Add `@media (prefers-reduced-motion: reduce)` block in `globals.css`
6. Change chat session `<div onClick>` items to `<button>` in `ChatPanel.tsx`
7. Add `encodeURIComponent` to Slack OAuth error redirect
8. Add message size validation to agent chat route
9. Fix `vitest.config.ts` glob to include `.test.tsx`
10. Move `DEFAULT_ORG_ID` to module scope in `middleware.ts`
