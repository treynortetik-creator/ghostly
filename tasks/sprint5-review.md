# Sprint 5: Security Hardening - Review

## Status: COMPLETE (all 6 tasks)

## Changes Summary

### Task 1: Database-Backed Rate Limiting
- **New:** `supabase/migrations/026_rate_limits.sql` - rate_limit_entries table
- **New:** `src/lib/rate-limiter.ts` - DB-backed rate limiter using Supabase REST API
- **Modified:** `src/app/api/auth/login/route.ts` - replaced in-memory rate limiter
- **Modified:** `src/app/api/health/route.ts` - replaced in-memory rate limiter
- **Modified:** `src/app/api/admin/cleanup/route.ts` - added rate limit entry cleanup

### Task 2: Batch Size Limits & Transaction Safety
- **Modified:** `src/app/api/import/brex/confirm/route.ts`
  - Added MAX_TRANSACTIONS_PER_REQUEST = 100
  - Added rollback tracking for soft-delete + insert atomicity
  - If insert fails after soft-deleting, the soft-deletes are reversed
- **Note:** bulk expenses route already had the 100-item limit

### Task 3: Audit Logging for Login Attempts
- **Modified:** `src/lib/audit.ts`
  - Extended AuditEntityType with 'auth'
  - Extended AuditAction with login_success, login_failure, login_rate_limited, api_key_auth
  - Extended AuditActorType with 'system'
  - Added AUTH_ENTITY_ID sentinel UUID
  - Added logAuditRest() for Edge-compatible fire-and-forget logging
- **Modified:** `src/app/api/auth/login/route.ts` - logs all login outcomes
- **Modified:** `src/middleware.ts` - logs API key auth usage

### Task 4: Startup Env Var Validation
- **New:** `src/lib/env-validation.ts` - validates required/optional env vars
- **New:** `src/instrumentation.ts` - Next.js instrumentation hook, runs once on startup

### Task 5: X-Request-ID Tracking Headers
- **Modified:** `src/middleware.ts`
  - Generates crypto.randomUUID() for each request
  - Sets x-request-id on request headers (downstream)
  - Sets X-Request-ID on response headers (client correlation)
  - All response paths (public, API key, cookie, errors, redirects) include the header
- **Modified:** `src/lib/error-logger.ts`
  - Added requestId field to ErrorLogEntry
  - Console logs include request ID prefix for correlation
  - Persisted to Supabase in the context JSON
- **Modified:** `src/lib/api-helpers.ts` - passes request ID to logError

### Task 6: PDF Parsing Timeout
- **Modified:** `src/app/api/import/pdf/route.ts`
  - Added Promise.race timeout (30 seconds) to parsePDF()
  - Timeout errors return 504 with descriptive message
  - Regular parse errors still return 422

## Notes
- Migration file (026_rate_limits.sql) written but NOT applied -- handle separately
- The /events page has a pre-existing useSearchParams() Suspense boundary build error, unrelated to Sprint 5
- TypeScript compilation passes clean (npx tsc --noEmit = 0 errors)
- Rate limiter fails open (allows requests) if DB is unavailable
