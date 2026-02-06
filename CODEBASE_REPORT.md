# The Counting House - Comprehensive Codebase Analysis

> Generated 2026-02-06 by 4-agent parallel review team

---

## Executive Summary

Four specialized agents analyzed the entire codebase in parallel: security audit, code quality review, feature gap analysis, and bug hunting. Here are the key numbers:

| Domain | Findings |
|--------|----------|
| Security | 2 CRITICAL, 4 HIGH, 7 MEDIUM, 5 LOW, 5 INFO |
| Code Quality | 4 HIGH, 6 MEDIUM, 7 LOW |
| Feature Gaps | PRD: 96% complete, Scrooge Phase 1: 100% (with gaps), Phase 2: 63%, Phase 3: 0% |
| Bugs | 2 HIGH, 5 MEDIUM, 9 LOW |

**Tests:** All 34 existing tests pass. But test coverage is critically low (single file covers only `business-logic.ts`).

---

## TOP 10 PRIORITY FIXES

These are the most impactful issues across all four reviews, ordered by severity and effort:

### 1. CRITICAL - Auth Header Spoofing (Security C1)
**File:** `src/middleware.ts:164-169`
Middleware sets internal `x-auth-*` headers for downstream routes but doesn't strip client-supplied versions. A cookie-authenticated user can inject `x-auth-agent-name`, `x-auth-permissions` to impersonate agents or escalate privileges. Audit logs can be forged.

**Fix:** Strip ALL `x-auth-*` headers from incoming requests at the top of middleware before auth processing.

### 2. CRITICAL/MEDIUM - Auth Bypass via Dot in URL Path (Security M2)
**File:** `src/middleware.ts:28`
`isPublicRoute` treats any path containing `.` as public. Crafted paths like `/api/expenses/.hidden` bypass authentication entirely.

**Fix:** Remove or restrict the dot check to non-API paths only.

### 3. HIGH - API Key Permissions Not Enforced (Security H4)
**Files:** All API routes except `api-keys/route.ts`
The permission system (`read`, `write`, `admin`) is defined but only checked on the `/api/api-keys` route. A `read`-only API key can create, update, and delete any resource.

**Fix:** Implement a `requirePermission()` helper and enforce it on every route handler.

### 4. HIGH - Non-Atomic Bulk Operations (Bug #1, #2)
**Files:** `src/app/api/expenses/bulk/update/route.ts`, `src/app/api/import/brex/confirm/route.ts`
Bulk update and import confirm iterate one-by-one. If item #50 of 100 fails, items 1-49 are already committed with no rollback. Client gets a 500 but data is partially mutated.

**Fix:** Wrap bulk operations in a Supabase RPC transaction or use database-level batch inserts.

### 5. HIGH - Cross-Event Resource Access (Bug #8-11)
**Files:** `src/app/api/events/[id]/checklist/[itemId]/route.ts`, `src/app/api/events/[id]/team/[assignmentId]/route.ts`
PUT and DELETE handlers for checklist items and team assignments only filter by the child ID, ignoring the event ID from the URL. `DELETE /api/events/event-B/checklist/item-from-event-A` succeeds.

**Fix:** Add `eq('event_id', eventId)` to all queries in these handlers.

### 6. HIGH - Password Length Timing Leak (Security H2)
**File:** `src/lib/auth.ts:67-74`
`verifyCredentials` returns early if password lengths differ, leaking the stored password length via timing.

**Fix:** Hash both passwords (e.g., SHA-256) before timing-safe comparison.

### 7. HIGH - Widespread `as any` Casts (Code Quality #1)
**Files:** 12+ locations in expense/export routes
Supabase join results are cast to `any` throughout, losing all type safety.

**Fix:** Create a typed `ExpenseWithJoins` interface and use it consistently.

### 8. MEDIUM - Paginated `total_amount` Only Sums Current Page (Bug #3)
**File:** `src/app/api/expenses/route.ts:194`
The `meta.total_amount` sums only the current page's expenses, not all matching expenses.

**Fix:** Run a separate aggregate query for the total sum, or use Supabase's count/sum capabilities.

### 9. MEDIUM - No Security Response Headers (Security M4)
**File:** `next.config.ts`
Missing: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`.

**Fix:** Add security headers via `next.config.ts` `headers()` config.

### 10. MEDIUM - Missing Audit Logging on Most Mutations (Code Quality #6)
**Files:** Categories, event-types, team, settings, bulk imports - all missing `logAudit` calls
Only expenses and events have audit logging. The Scrooge spec requires comprehensive audit coverage.

**Fix:** Add `logAudit()` calls to all mutation handlers.

---

## SECURITY AUDIT (23 findings)

### Critical (2)
| # | Finding | File |
|---|---------|------|
| C1 | Auth header spoofing - `x-auth-*` headers can be injected by clients | `middleware.ts` |
| C2 | No RLS on any database table (mitigated: service role key only) | All migrations |

### High (4)
| # | Finding | File |
|---|---------|------|
| H1 | Service role key used in public health endpoint | `health/route.ts` |
| H2 | Timing-safe comparison bypassed by password length check | `auth.ts:71` |
| H3 | In-memory rate limiting per-instance, easily bypassed | `login/route.ts` |
| H4 | API key permissions not enforced on any route except api-keys | All API routes |

### Medium (7)
| # | Finding | File |
|---|---------|------|
| M1 | Service role key in edge middleware bundle | `middleware.ts` |
| M2 | Dot in URL path bypasses auth (`pathname.includes('.')`) | `middleware.ts:28` |
| M3 | No CSRF protection (mitigated by SameSite=strict) | `middleware.ts` |
| M4 | No security response headers | `next.config.ts` |
| M5 | PDF parse library arbitrary code execution risk | `import/pdf/route.ts` |
| M6 | Idempotency keys not scoped to user/API key | `idempotency.ts` |
| M7 | Admin errors POST has no permission check | `admin/errors/route.ts` |

### Low (5)
| # | Finding | File |
|---|---------|------|
| L1 | JWT missing issuer/audience claims | `auth.ts` |
| L2 | Error messages leak internal details (PDF parser errors) | `import/pdf/route.ts` |
| L3 | OpenRouter referer header defaults to localhost | `openrouter.ts` |
| L4 | setInterval in module scope for rate limit cleanup | `login/route.ts` |
| L5 | Fire-and-forget with no error logging | `middleware.ts`, `auth.ts` |

### Info (5)
| # | Finding | File |
|---|---------|------|
| I1 | Single-user plaintext env var auth (appropriate for use case) | `auth.ts` |
| I2 | No CORS configuration (appropriate for same-origin) | `next.config.ts` |
| I3 | Soft delete consistently applied (positive finding) | All routes |
| I4 | No JSON body size limits (Next.js defaults apply) | All POST/PUT routes |
| I5 | Audit logging incomplete coverage | `audit.ts` |

---

## CODE QUALITY REVIEW (17 findings)

### High (4)
| # | Category | Finding | File(s) |
|---|----------|---------|---------|
| 1 | TYPE_SAFETY | 12+ `as any` casts on Supabase join results | Expense/export routes |
| 2 | PATTERNS | Export routes duplicate `getDateRangeForScope`, `escapeCSVValue`, `formatCurrency` | `export/csv`, `export/excel` |
| 3 | PATTERNS | Import route duplicates `parseCSVLine` and `findDuplicate` from business-logic | `import/brex/route.ts` |
| 8 | TESTING | Single test file - zero tests for API routes, middleware, auth, components | `business-logic.test.ts` |

### Medium (6)
| # | Category | Finding | File(s) |
|---|----------|---------|---------|
| 4 | TYPE_SAFETY | `supabase: any` parameter in openrouter | `openrouter.ts:192` |
| 5 | ERROR_HANDLING | Inconsistent `logError` - many routes only use `console.error` | 8+ route files |
| 6 | PATTERNS | Missing audit logging on categories, team, settings, imports, bulk ops | 9+ route files |
| 7 | PERFORMANCE | All-expenses fetches for totals (won't scale) | Events, categories, dashboard, stats |
| 10 | ASYNC | In-memory error log lost on restart | `error-logger.ts:60` |
| 11 | TYPE_SAFETY | Manual `Database` type out of sync with Supabase schema | `database.ts` |

### Low (7)
| # | Category | Finding |
|---|----------|---------|
| 9 | DEAD_CODE | `EventType` enum marked deprecated but still actively used |
| 12 | PATTERNS | Hardcoded "FY 2026" in UI footer and exports |
| 13 | REACT | Missing useEffect dependency in EventForm |
| 14 | PATTERNS | Inconsistent error response shapes across routes |
| 15 | PERFORMANCE | N+1 query in event detail (separate fiscal year fetch) |
| 16 | PATTERNS | setInterval in module scope for rate limit cleanup |
| 17 | TYPE_SAFETY | Unsafe JSON.parse on middleware headers in api-keys route |

---

## FEATURE GAP ANALYSIS

### PRD Features: 96% Complete (26/27)

| Feature | Status |
|---------|--------|
| Dashboard (budget vs actual, by type, by quarter, indicators, progress bars) | Implemented |
| Events CRUD + filtering | Implemented |
| Expenses CRUD + filtering | Implemented |
| Budget Categories CRUD | Implemented |
| Brex CSV Import (AI categorization, review, duplicate detection) | Implemented |
| PDF Invoice Import (extract, review, save) | Implemented |
| Export (CSV + Excel) | Implemented |
| Fiscal Year selector + filtering | Implemented |
| Victorian theme | Implemented |
| Full-text search across all fields | **Partial** (vendor only) |

### Scrooge API Spec Coverage

#### Phase 1 - Foundation (6/6 Implemented, with detail gaps)
| Feature | Status | Gap |
|---------|--------|-----|
| API Key Auth | Done | - |
| Health Check | Done | Missing OpenRouter health check |
| Idempotency Keys | Done | Not scoped per API key (spec requires it) |
| Bulk Expense Create | Done | No 207 Multi-Status partial failure support |
| Audit Logging | Done | Only on expenses/events, not all entities |
| modified_after/ids params | Done | Missing on event-types, team, fiscal-years, checklist-templates |

#### Phase 2 - Intelligence (5/8 Implemented)
| Feature | Status |
|---------|--------|
| Upcoming Events | Implemented |
| Event Summary | Implemented |
| Global Stats | Implemented (simplified response) |
| Bulk Expense Update | Implemented (different URL path) |
| Reminder System | Implemented (simplified config) |
| Webhook System | **Missing** |
| Budget Alert Webhooks | **Missing** |
| Batch Read (ids) on all endpoints | **Partial** (3 of 7) |

#### Phase 3 - Integration (0/7 Implemented)
All missing: Monday.com Sync, Slack Notifications, Document Generation, Report Generation, Enhanced Search, Enhanced Filters, Rate Limiting.

### Bonus: Extra Features Not in Spec
Event Types management, Team Members CRUD, Event Team Assignments, Checklist Templates, Event Checklists, ROI Tracking, Settings/Admin page, Export Preview, Admin Error Logs.

---

## BUG REPORT (16 bugs)

### High (2)
| # | Bug | File |
|---|-----|------|
| 1 | Bulk update non-atomic - partial writes on failure | `expenses/bulk/update/route.ts` |
| 2 | Import confirm non-atomic - partial writes on failure | `import/brex/confirm/route.ts` |

### Medium (5)
| # | Bug | File |
|---|-----|------|
| 3 | `total_amount` only sums current page, not all matching | `expenses/route.ts:194` |
| 4 | Events GET fetches ALL expenses unbounded | `events/route.ts:116-123` |
| 5 | Idempotency key race condition on expired key cleanup | `idempotency.ts:46-73` |
| 8-9 | Checklist PUT/DELETE doesn't verify event ownership | `events/[id]/checklist/[itemId]/route.ts` |
| 10-11 | Team assignment PUT/DELETE doesn't verify event ownership | `events/[id]/team/[assignmentId]/route.ts` |

### Low (9)
| # | Bug | File |
|---|-----|------|
| 6 | `parseBrexDate` doesn't validate calendar date values | `business-logic.ts:44-55` |
| 7 | Category duplicate check `.single()` logs PGRST116 | `categories/[id]/route.ts` |
| 12 | Brex import ID collision within same millisecond | `import/brex/route.ts:158` |
| 13 | Reminder check race condition - double-send possible | `reminders/check/route.ts` |
| 14 | Export quarter filter inconsistency events vs expenses | `export/csv/route.ts` |
| 15 | `sanitizeCurrencyInput` allows odd edge cases | `business-logic.ts:92-99` |
| 16 | `parseInt` without fallback writes NaN to DB | `events/[id]/route.ts:205-206` |

---

## RECOMMENDED ACTION PLAN

### Immediate (Security + Data Integrity)
1. Strip `x-auth-*` headers in middleware (C1)
2. Fix dot-in-path auth bypass (M2)
3. Enforce API key permissions on all routes (H4)
4. Add `eq('event_id', eventId)` to checklist/team handlers (Bugs #8-11)
5. Add `|| 0` fallback to parseInt calls in events PUT (Bug #16)

### Short-Term (Code Health)
6. Wrap bulk ops in transactions (Bugs #1-2)
7. Fix paginated total_amount calculation (Bug #3)
8. Add security response headers (M4)
9. Hash passwords before timing-safe comparison (H2)
10. Complete audit logging coverage (Code Quality #6)

### Medium-Term (Quality + Performance)
11. Create proper Supabase join types to replace `as any` (Code Quality #1)
12. Extract shared export/import helpers (Code Quality #2-3)
13. Add database-side aggregation for expense totals (Code Quality #7)
14. Add API route tests and middleware tests (Code Quality #8)
15. Scope idempotency keys per API key (M6)

### Long-Term (Feature Completion)
16. Implement webhook system (Scrooge Phase 2)
17. Complete `modified_after`/`ids` on all list endpoints
18. Implement rate limiting
19. Scrooge Phase 3 features (Monday.com, Slack, etc.)
