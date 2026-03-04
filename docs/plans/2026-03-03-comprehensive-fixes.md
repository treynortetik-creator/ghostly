# Comprehensive Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix all 122 findings from the 2026-03-03 comprehensive codebase review — 3 critical, 33 high, 43 medium, 31 low, 12 info items across security, code quality, UI/UX, accessibility, production readiness, and feature gaps.

**Architecture:** Work through findings by priority (critical → high → medium → low), grouped by theme so related changes are batched together. Each task is independently executable. Security and data-integrity fixes first, then DRY/refactoring, then UI/UX, then features.

**Tech Stack:** Next.js 16.1, Supabase (Postgres + RLS), Tailwind CSS v4, TypeScript, Vitest, Railway

---

## Task 1: Critical Security — Slack Digest Auth + CRON_SECRET Scope + Missing Org Filters

**Severity:** CRITICAL + HIGH (CRIT-1, S-3, S-4, Q-1)

**Files:**
- Modify: `src/app/api/integrations/slack/digest/route.ts:14-18`
- Modify: `src/middleware.ts:380-393`
- Modify: `src/app/api/events/[id]/route.ts:46`
- Modify: `src/lib/webhook-sender.ts:27`

**Fix 1 — CRIT-1: Slack digest auth bypass (1 line)**

In `src/app/api/integrations/slack/digest/route.ts`, change line 16 from:
```typescript
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
```
to:
```typescript
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
```

**Fix 2 — S-3: Scope CRON_SECRET bypass to specific routes only**

In `src/middleware.ts`, the internal worker auth block (lines 380-393) currently grants full admin to ANY route. Restrict it to only the routes the worker actually calls:

```typescript
const internalSecret = request.headers.get('x-internal-cron-secret');
if (cronSecret && internalSecret === cronSecret) {
  // Only allow internal worker auth on agent/heartbeat and agent/worker routes
  const allowedInternalPaths = ['/api/agent/heartbeat', '/api/agent/worker'];
  const isAllowedPath = allowedInternalPaths.some(p => pathname.startsWith(p));
  if (!isAllowedPath) {
    return NextResponse.json({ error: 'Internal auth not allowed on this route' }, { status: 403 });
  }
  // ... existing header setting code ...
}
```

**Fix 3 — S-4: Add organization_id filter to event expense query**

In `src/app/api/events/[id]/route.ts`, add `.eq('organization_id', orgId)` to the expenses query:
```typescript
const { data: expenses, error: expensesError } = await supabase
  .from('expenses')
  .select('*')
  .eq('event_id', id)
  .eq('organization_id', orgId)  // ADD THIS
  .is('deleted_at', null)
  .order('expense_date', { ascending: false });
```

**Fix 4 — Q-1: Add organization_id filter to webhook sender**

In `src/lib/webhook-sender.ts`, the webhook query must filter by org:
```typescript
const { data: webhooks } = await supabase
  .from('webhooks')
  .select('id, url, secret, event_types')
  .eq('is_active', true)
  .eq('organization_id', organizationId);  // ADD THIS
```

The `sendWebhookEvent` function signature needs an `organizationId` parameter added. Update all call sites to pass it.

**Testing:**
```bash
npx vitest run --reporter=verbose 2>&1 | head -50
npm run build 2>&1 | tail -20
```

**Commit:** `fix: critical security — auth bypass, org scoping, webhook tenant isolation`

---

## Task 2: Tailwind v4 — Placeholder Syntax + Focus Indicators

**Severity:** CRITICAL (CRIT-2, CRIT-3)

**Files to fix placeholder syntax (`placeholder-muted-foreground/50` → `placeholder:text-muted-foreground/50`):**
- `src/components/categories/CategoryForm.tsx:103`
- `src/components/categories/CategoryList.tsx:133`
- `src/components/settings/EventTypeForm.tsx:101`
- `src/components/expenses/ExpenseFilters.tsx:64`
- `src/components/expenses/ExpenseForm.tsx:169`
- `src/components/events/EventForm.tsx:178`
- `src/components/events/EventList.tsx:390`
- `src/app/settings/cadence/page.tsx:23`
- `src/app/admin/audit/page.tsx:201`
- `src/app/webhooks/page.tsx:390,413,465`

**Also fix `/40` variant (`placeholder-muted-foreground/40` → `placeholder:text-muted-foreground/40`):**
- `src/components/contacts/ContactForm.tsx:36`
- `src/components/team/TeamMemberForm.tsx:107,124,142,158,176`
- `src/components/checklist/ChecklistItemForm.tsx:92,109,126,151,167`
- `src/components/documents/TemplateBuilder.tsx:38`
- `src/components/documents/SortableSection.tsx:33`
- `src/app/contacts/page.tsx:156`
- `src/components/events/AssignTeamMemberModal.tsx:188`

**Global find-replace:**
```
placeholder-muted-foreground/50  →  placeholder:text-muted-foreground/50
placeholder-muted-foreground/40  →  placeholder:text-muted-foreground/40
```

**Fix focus indicators (CRIT-3):**

Replace `focus:border-transparent` pattern with accessible focus pattern. In all files above that use:
```
focus:outline-none focus:ring-2 focus:ring-spectral focus:border-transparent
```
Replace with:
```
focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral focus:ring-offset-1 focus:ring-offset-background
```

This matches the pattern already used in `EventForm.tsx`.

**Testing:**
```bash
# Verify no broken placeholder classes remain
grep -rn "placeholder-muted-foreground" src/ --include="*.tsx" --include="*.ts"
# Should return 0 results

# Verify no focus:border-transparent remains in form inputs
grep -rn "focus:border-transparent" src/ --include="*.tsx" --include="*.ts"
# Should return 0 results

npm run build 2>&1 | tail -20
```

**Commit:** `fix: tailwind v4 placeholder syntax and accessible focus indicators`

---

## Task 3: CSP Headers + Config Fixes

**Severity:** HIGH (S-2, S-6, P-9)

**Files:**
- Modify: `next.config.ts:20-24`
- Modify: `src/app/api/health/route.ts:79`
- Modify: `vitest.config.ts`

**Fix 1 — S-2 + S-6: Update CSP headers**

In `next.config.ts`, update CSP:
```typescript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self'",                    // REMOVE 'unsafe-inline'
    "style-src 'self' 'unsafe-inline'",     // keep — Tailwind/CSS-in-JS needs it
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co https://openrouter.ai",  // ADD Supabase + OpenRouter
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
},
```

**Important:** After removing `'unsafe-inline'` from `script-src`, verify the app still works. If Next.js injects inline scripts (it does for the theme script in layout.tsx), we may need to use a nonce approach or keep `'unsafe-inline'`. Test this carefully — if the theme flash prevention script breaks, revert `script-src` to include `'unsafe-inline'` but add a comment explaining why.

**Fix 2 — P-9: Remove OpenRouter from health check**

In `src/app/api/health/route.ts`, remove the OpenRouter connectivity check entirely. Health checks should only test internal dependencies (DB):
```typescript
// DELETE the entire OpenRouter connectivity check block (lines ~75-85)
// Health check should only verify database connectivity, not burn API quota
```

**Fix 3 — Vitest config: Include .test.tsx files**

In `vitest.config.ts`, update the include pattern:
```typescript
test: {
  environment: 'node',
  include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
},
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
npx vitest run --reporter=verbose 2>&1 | head -50
```

**Commit:** `fix: CSP headers, health check, vitest config`

---

## Task 4: Error Boundaries + Not Found Page

**Severity:** HIGH (P-4)

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/global-error.tsx`
- Create: `src/app/not-found.tsx`

**Create `src/app/error.tsx`:**
```tsx
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-foreground mb-4">Something went wrong</h2>
        <p className="text-mist mb-6">An unexpected error occurred. Please try again.</p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-spectral text-white rounded-lg hover:bg-spectral/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

**Create `src/app/global-error.tsx`:**
```tsx
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#1a1625', color: '#e8e4ef' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Something went wrong</h2>
            <p style={{ color: '#9B8FB8', marginBottom: '1.5rem' }}>A critical error occurred.</p>
            <button
              onClick={reset}
              style={{ padding: '0.625rem 1.5rem', background: '#7C3AED', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

**Create `src/app/not-found.tsx`:**
```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-4xl font-bold text-foreground mb-2">404</h2>
        <p className="text-xl text-foreground mb-4">Page not found</p>
        <p className="text-mist mb-6">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-2.5 bg-spectral text-white rounded-lg hover:bg-spectral/90 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `feat: add error boundaries and not-found page`

---

## Task 5: Rate Limiting + Input Validation

**Severity:** HIGH (S-5, P-7, plus medium items)

**Files:**
- Modify: `src/app/api/agent/chat/route.ts`
- Modify: `src/app/api/waitlist/route.ts`
- Create or modify: `src/lib/rate-limit.ts` (if not exists, check existing pattern)

**Fix 1 — S-5 + P-7: Rate limit agent chat + message size limit**

In `src/app/api/agent/chat/route.ts`, add at the top of the POST handler:

```typescript
// Message size limit (16KB text + context)
const MAX_MESSAGE_LENGTH = 16_384;

// In the handler, after parsing the body:
if (message && message.length > MAX_MESSAGE_LENGTH) {
  return NextResponse.json(
    { error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` },
    { status: 400 }
  );
}
```

For rate limiting, use the same `checkRateLimit` pattern from `src/app/api/auth/login/route.ts`. Import or duplicate:
```typescript
// At top of handler:
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || request.headers.get('x-real-ip')
  || 'unknown';
const rateLimited = checkRateLimit(`agent-chat:${ip}`, 20, 60_000); // 20 requests/min
if (rateLimited) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

**Fix 2 — Rate limit waitlist endpoint**

In `src/app/api/waitlist/route.ts`, add rate limiting:
```typescript
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || request.headers.get('x-real-ip')
  || 'unknown';
const rateLimited = checkRateLimit(`waitlist:${ip}`, 5, 60_000); // 5 requests/min
if (rateLimited) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `fix: rate limiting on agent chat and waitlist, message size limit`

---

## Task 6: Database Types — Add Agent Tables

**Severity:** HIGH (Q-3)

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/agent/runtime.ts` (remove `as any`)
- Modify: `src/lib/agent/memory.ts` (remove `as any`)
- Modify: `src/lib/agent/worker.ts` (remove `as any`)

**Step 1:** Use Supabase MCP `generate_typescript_types` to get the current schema, then merge the missing agent tables into `src/types/database.ts`.

The missing tables that need type definitions:
- `agent_runs`
- `agent_memories`
- `agent_learnings`
- `agent_background_tasks`
- `agent_trigger_notifications`

**Step 2:** After adding the types, remove all `supabase as any` casts in the agent files and replace with properly typed Supabase client calls.

For example in `runtime.ts`:
```typescript
// BEFORE:
const supabaseAny = supabase as any;
const { error } = await supabaseAny.from('agent_runs').insert({...});

// AFTER:
const { error } = await supabase.from('agent_runs').insert({...});
```

**Step 3:** Fix the `tool_calls` type bridges:
```typescript
// Use a proper type assertion instead of double-cast:
tool_calls: assistantMessage.tool_calls as unknown as Json[]
```

**Testing:**
```bash
npx tsc --noEmit 2>&1 | head -50
npm run build 2>&1 | tail -20
```

**Commit:** `fix: add agent table types, remove 29 'as any' casts`

---

## Task 7: DRY Refactoring — Centralize Duplicated Logic

**Severity:** HIGH (R-1 through R-4, Q-4)

**Files:**
- Create: `src/lib/ai.ts` (centralized OpenRouter config + model constants)
- Create: `src/lib/uploads.ts` (centralized upload path)
- Modify: `src/lib/postgrest.ts` (remove `escapeLikePattern`, import from `business-logic.ts`)
- Modify: 7 files with `OPENROUTER_API_URL` duplication
- Modify: 5 files with `getUploadBasePath` duplication
- Modify: 3 files with `AGENT_MODEL` duplication

**Fix 1 — Centralize OpenRouter config**

Create `src/lib/ai.ts`:
```typescript
/**
 * Centralized AI/OpenRouter configuration.
 * All OpenRouter calls should use these constants.
 */
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_AGENT_MODEL = 'anthropic/claude-sonnet-4';
```

Update all 7 files that define `OPENROUTER_API_URL` to import from `@/lib/ai`.
Update all 3 files that define `AGENT_MODEL`/`DEFAULT_MODEL` to import from `@/lib/ai`.

**Fix 2 — Centralize upload path**

Create `src/lib/uploads.ts`:
```typescript
import path from 'path';

export function getUploadBasePath(): string {
  return path.resolve(process.cwd(), process.env.DOCUMENT_UPLOAD_DIR || 'uploads');
}
```

Update all 5 definition sites to import from `@/lib/uploads`.

**Fix 3 — Deduplicate escapeLikePattern**

In `src/lib/postgrest.ts`, remove the local `escapeLikePattern` and import from `business-logic.ts`:
```typescript
import { escapeLikePattern } from './business-logic';
```

**Fix 4 — Move DEFAULT_ORG_ID to module scope**

In `src/middleware.ts`, move `DEFAULT_ORG_ID` from inside the function body to module scope:
```typescript
// At top of file, module scope:
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
```

**Testing:**
```bash
npx tsc --noEmit 2>&1 | head -50
npm run build 2>&1 | tail -20
```

**Commit:** `refactor: centralize OpenRouter config, upload paths, escape patterns`

---

## Task 8: UI Quick Fixes

**Severity:** HIGH + MEDIUM (U-1 through U-4)

**Files:**
- Modify: `src/app/login/page.tsx:245` (password icon)
- Modify: 5 files with "FY 2026" hardcoded
- Modify: `src/app/events/[id]/page.tsx:459` (use ConfirmDialog)
- Modify: `src/components/ui/ConfirmDialog.tsx:40` (fix null return)
- Modify: `src/components/ui/Toast.tsx:46` (fix role)

**Fix 1 — Login password icon: `User` → `Lock`**

In `src/app/login/page.tsx`, line 5 add `Lock` to imports:
```typescript
import { User, Mail, Lock } from 'lucide-react';
```
Line 245, change `<User` to `<Lock`:
```tsx
<Lock className="w-4 h-4 text-mist" />
```

**Fix 2 — Dynamic fiscal year**

In all 5 files, replace hardcoded "FY 2026" with dynamic:
```tsx
FY {new Date().getFullYear()} Events
```

Files:
- `src/app/events/page.tsx:131`
- `src/app/expenses/page.tsx:353`
- `src/app/categories/page.tsx:119`
- `src/components/dashboard/QuarterSummary.tsx:208`
- `src/components/dashboard/BudgetOverviewCard.tsx:68`

**Fix 3 — ConfirmDialog: Don't return null when closed**

In `src/components/ui/ConfirmDialog.tsx`, remove the `if (!open) return null;` line. Instead, always render the `<dialog>` but control visibility via the native `showModal()`/`close()` methods:
```tsx
// REMOVE: if (!open) return null;
// The dialog element should always be in the DOM so the ref works
```

**Fix 4 — Event delete: Use ConfirmDialog**

In `src/app/events/[id]/page.tsx`, replace the inline Card-based confirm UI (lines 459-499) with the existing `<ConfirmDialog>` component:
```tsx
<ConfirmDialog
  open={showDeleteConfirm}
  onOpenChange={setShowDeleteConfirm}
  title="Delete Event"
  description="Are you sure you want to delete this event? This action can be undone by an administrator."
  confirmLabel="Delete"
  variant="destructive"
  isLoading={isDeleting}
  onConfirm={handleDeleteEvent}
/>
```

**Fix 5 — Toast: Fix role and aria-live**

In `src/components/ui/Toast.tsx`, change the container:
```tsx
<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
```
Remove `role="alert"` from the container. Add per-toast roles:
```tsx
// In ToastItem component:
<div role={toast.type === 'error' ? 'alert' : 'status'} ...>
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `fix: UI quick fixes — password icon, dynamic FY, confirm dialog, toast a11y`

---

## Task 9: Accessibility Hardening

**Severity:** MEDIUM (accessibility items from UI/UX review)

**Files:**
- Modify: `src/components/layout/AppShell.tsx` (aria-expanded on collapse buttons)
- Modify: `src/app/globals.css` (prefers-reduced-motion)
- Modify: `src/components/agent/ChatPanel.tsx` (div onClick → button)

**Fix 1 — Sidebar collapse buttons: Add aria-expanded**

In `src/components/layout/AppShell.tsx`:

Main collapse toggle (line ~409):
```tsx
<button
  onClick={toggleCollapsed}
  aria-expanded={!isCollapsed}
  title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
  ...
>
```

Section collapse buttons (desktop ~274, mobile ~531):
```tsx
<button
  onClick={() => toggleSection(group.label!)}
  aria-expanded={!collapsedSections.has(group.label!)}
  ...
>
```

**Fix 2 — Reduced motion media query**

In `src/app/globals.css`, add:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Fix 3 — Chat session items: div onClick → button**

In `src/components/agent/ChatPanel.tsx`, find chat session list items that use `<div onClick>` and replace with `<button>`:
```tsx
// BEFORE:
<div onClick={() => selectSession(s.id)} className="...">

// AFTER:
<button onClick={() => selectSession(s.id)} className="... text-left w-full">
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `fix: accessibility — aria-expanded, reduced motion, semantic buttons`

---

## Task 10: Infra + Config Files

**Severity:** HIGH (P-2, P-3)

**Files:**
- Create: `railway.toml`
- Modify: `.env.example`

**Create `railway.toml`:**
```toml
[build]
builder = "nixpacks"

[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 120
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

**Update `.env.example`:**

Add missing env vars:
```
# Auth
AUTH_USERNAME=
AUTH_PASSWORD=
JWT_SECRET=
CRON_SECRET=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# App
NEXT_PUBLIC_APP_URL=

# AI
OPENROUTER_API_KEY=

# Documents
DOCUMENT_UPLOAD_DIR=uploads
DOCUMENT_MAX_SIZE_MB=10

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `feat: add railway.toml, update .env.example`

---

## Task 11: Agent Worker Optimization

**Severity:** HIGH (Q-2)

**Files:**
- Modify: `src/lib/agent/worker.ts`

Reduce redundant Supabase client creation. Instead of calling `createClient()` inside every function, create a single client at the top of `runAgentWorker()` and pass it through:

```typescript
export async function runAgentWorker(options?: WorkerOptions): Promise<WorkerSummary> {
  const supabase = createClient();
  // Pass supabase to all sub-functions:
  const orgIds = await getOrgIds(supabase, options?.orgId);
  for (const orgId of orgIds) {
    await runHeartbeatForOrg(supabase, orgId);
    await runCronJobsForOrg(supabase, orgId);
    // ...
  }
}
```

Update all internal functions to accept `supabase` as a parameter instead of creating their own.

**Testing:**
```bash
npx tsc --noEmit 2>&1 | head -50
npm run build 2>&1 | tail -20
```

**Commit:** `refactor: agent worker — single Supabase client per run`

---

## Task 12: Export + Query Safety

**Severity:** HIGH (P-8)

**Files:**
- Modify: `src/app/api/export/excel/route.ts:54`
- Modify: `package.json` (replace xlsx with exceljs)

**Fix 1 — Add row limits to export queries**

```typescript
// Add .limit(10000) to unbounded queries:
supabase.from('events').select('*, event_types(*)').eq('organization_id', orgId).is('deleted_at', null).limit(10000),
supabase.from('budget_categories').select('*').eq('organization_id', orgId).is('deleted_at', null).limit(10000),
```

**Fix 2 — Replace xlsx with exceljs (S-1)**

```bash
npm uninstall xlsx
npm install exceljs
```

Update `src/app/api/export/excel/route.ts` to use exceljs API instead of xlsx. The exceljs API is different:
```typescript
import ExcelJS from 'exceljs';

// Instead of XLSX.utils.json_to_sheet, use:
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Events');
sheet.columns = [/* column definitions */];
sheet.addRows(events);

const buffer = await workbook.xlsx.writeBuffer();
return new Response(buffer, {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="export.xlsx"`,
  },
});
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `fix: export query limits, replace xlsx with exceljs`

---

## Task 13: Slack OAuth Encoding + Error Logger Fixes

**Severity:** MEDIUM

**Files:**
- Modify: `src/app/api/integrations/slack/oauth/callback/route.ts:23`
- Modify: `src/lib/error-logger.ts:41`

**Fix 1 — Encode Slack error parameter**

```typescript
// BEFORE:
return NextResponse.redirect(`${appUrl}/integrations?error=${error}`);

// AFTER:
return NextResponse.redirect(`${appUrl}/integrations?error=${encodeURIComponent(error || 'unknown')}`);
```

**Fix 2 — Replace deprecated substr**

In `src/lib/error-logger.ts`:
```typescript
// BEFORE:
id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

// AFTER:
id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `fix: Slack OAuth encoding, deprecated substr`

---

## Task 14: File Storage Migration to Supabase Storage

**Severity:** HIGH (P-1, F-5)

**Files:**
- Create: `src/lib/storage.ts` (Supabase Storage wrapper)
- Modify: `src/app/api/documents/route.ts` (upload to Supabase Storage)
- Modify or create: `src/app/api/documents/[id]/download/route.ts` (serve from Supabase Storage)
- Apply: database migration for storage bucket

**Step 1: Create storage bucket migration**

Use Supabase MCP to create a storage bucket:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,  -- 10MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv']
);
```

**Step 2: Create storage helper**

Create `src/lib/storage.ts`:
```typescript
import { createClient } from '@/lib/supabase/server';

const BUCKET_NAME = 'documents';

export async function uploadDocument(
  orgId: string,
  docId: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const supabase = createClient();
  const storagePath = `${orgId}/${docId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

export async function downloadDocument(storagePath: string): Promise<Blob> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return data;
}

export async function deleteDocument(storagePath: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
```

**Step 3:** Update document upload route to use `uploadDocument()` instead of `fs.writeFile()`.

**Step 4:** Add a `storage_path` column to the `documents` table via migration.

**Step 5:** Create download route that uses `downloadDocument()`.

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `feat: migrate document storage to Supabase Storage`

---

## Task 15: Agent Tools — Missing CRUD Operations

**Severity:** HIGH (F-4)

**Files:**
- Modify: `src/lib/agent/tools.ts`

Add missing tools:
1. `get_contacts` — list/search contacts for the org
2. `update_expense` — update expense amount, vendor, category, date
3. `delete_expense` — soft-delete an expense
4. `get_checklist_items` — list all checklist items for an event
5. `update_checklist_item` — mark complete, change due date
6. `delete_checklist_item` — soft-delete
7. `update_team_member` — update role, contact info
8. `update_contact` — update contact details

Each tool follows the existing pattern in `tools.ts` — define tool with `name`, `description`, `parameters`, `permission`, and `handler`. Handlers use the same Supabase client and org scoping pattern.

**Testing:**
```bash
npx tsc --noEmit 2>&1 | head -50
npm run build 2>&1 | tail -20
```

**Commit:** `feat: add missing agent tools — contacts, expenses, checklist, team CRUD`

---

## Task 16: Medium Priority Code Quality Fixes

**Severity:** MEDIUM

**Files:**
- Modify: `src/lib/idempotency.ts` (TOCTOU fix)
- Modify: `src/app/api/events/route.ts:185` (remove redundant JS sort)
- Modify: Multiple files with `.catch(() => {})` (add logging)
- Modify: `src/middleware.ts` (move `AUTH_COOKIE_NAME` to shared location)

**Fix 1 — Idempotency TOCTOU**: Use a DB-level advisory lock or `INSERT ... ON CONFLICT` instead of check-then-act.

**Fix 2 — Remove redundant sort**: In `src/app/api/events/route.ts:185`, remove the JavaScript `.sort()` since the DB already orders the results.

**Fix 3 — Silent catch blocks**: In files with `.catch(() => {})`, add `console.error`:
```typescript
// BEFORE:
.catch(() => {})

// AFTER:
.catch((err) => console.error('Budget alert failed:', err))
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `fix: idempotency TOCTOU, redundant sort, silent error swallowing`

---

## Task 17: Medium Priority UI/UX Fixes

**Severity:** MEDIUM

**Files:**
- Modify: `src/components/layout/AppShell.tsx` (sidebar tooltip aria-hidden)
- Modify: `src/app/globals.css` (--mist dark mode contrast)
- Modify: `src/components/agent/ChatPanel.tsx` (resize handle width)

**Fix 1 — Sidebar tooltip aria-hidden**

Add `aria-hidden="true"` to tooltip spans in collapsed sidebar mode.

**Fix 2 — --mist dark mode contrast**

In `src/app/globals.css`, increase `--mist` dark mode value from `#6B5F82` (3.6:1 ratio) to `#8B7FA8` (~4.6:1 ratio, passes WCAG AA):
```css
.dark {
  --mist: #8B7FA8;
}
```

**Fix 3 — Chat resize handle**

In `src/components/agent/ChatPanel.tsx`, increase the resize handle from 6px to 10px.

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `fix: UI accessibility — tooltip aria-hidden, mist contrast, resize handle`

---

## Task 18: Medium Priority Feature Gaps

**Severity:** MEDIUM

**Files:**
- Modify: `src/app/api/export/excel/route.ts` (add events/contacts/team export)
- Modify: Dashboard components (add alert widgets)

**Fix 1 — Export coverage**: Add events, contacts, and team members as additional sheets in the Excel export (the route already exports expenses — add more tabs).

**Fix 2 — Dashboard alerts**: Add simple alert widgets to the dashboard for overdue tasks, over-budget events, and upcoming events in the next 7 days.

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `feat: expanded export sheets, dashboard alert widgets`

---

## Task 19: Low Priority Code Quality Batch

**Severity:** LOW

**Files:**
- Various (11+ files with `error instanceof Error` pattern)
- `src/lib/error-logger.ts` (deprecated `substr`)
- Various (44 `console.error` calls)
- `src/app/api/auth/login/route.ts` (IP extraction)

**Batch fixes:**
1. Extract `getErrorMessage(error: unknown): string` utility in `src/lib/utils.ts`
2. Replace all 11+ instances of `error instanceof Error ? error.message : String(error)`
3. Standardize IP extraction using a shared `getClientIp(request: NextRequest): string` utility
4. Replace `randomId()` vs inline `Math.random()` with consistent usage

**Testing:**
```bash
npx tsc --noEmit 2>&1 | head -50
npm run build 2>&1 | tail -20
```

**Commit:** `refactor: extract error message util, standardize IP extraction`

---

## Task 20: Low Priority UI/UX Batch

**Severity:** LOW

**Files:**
- `src/app/login/page.tsx` (already fixed in Task 8)
- `src/components/agent/ChatPanel.tsx` (FloatingDock hidden indicator)
- Various (CardTitle h3 hierarchy)
- Various (ButtonGroup role="group")

**Batch fixes:**
1. `FloatingDock` hidden indicator: `<div onClick>` → `<button>`
2. Add `role="group"` to `ButtonGroup` component
3. `OrgSwitcher`: add `aria-expanded` and Escape key handling

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `fix: low priority a11y — semantic buttons, ARIA roles`

---

## Task 21: Feature — Organization Management UI

**Severity:** HIGH feature gap (F-1)

**Files:**
- Create: `src/app/settings/organization/page.tsx`
- Create: `src/components/settings/OrgSettings.tsx`
- Modify: `src/components/layout/AppShell.tsx` (add nav link)

Build a basic org management page under Settings:
- View current org name and details
- Edit org name
- View members (users in the org)
- Invite new members (send email invitation)

This requires new API routes:
- `src/app/api/organizations/route.ts` (GET current, PUT update)
- `src/app/api/organizations/members/route.ts` (GET members, POST invite)

And a database migration to support invitations:
```sql
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Testing:**
```bash
npm run build 2>&1 | tail -20
```

**Commit:** `feat: organization management UI — view, edit, invite members`

---

## Task 22: Remaining Medium + Low Items Batch

**Severity:** MEDIUM/LOW

Batch the remaining items that haven't been covered:

1. **Structured logging**: Replace inconsistent `console.error` with `logError` from error-logger
2. **Agent cron autonomy_mode**: Check `autonomy_mode` setting before running write tools
3. **Saved filter presets**: Persist filter state to backend (add `user_preferences` table)
4. **Webhook event types**: Add agent action events to webhook delivery
5. **Default fiscal year in export**: Replace hardcoded 2026 with `new Date().getFullYear()`
6. **Legacy auth cookie name**: Consolidate `AUTH_COOKIE_NAME` declarations
7. **JSON markdown stripping**: Deduplicate between routes and openrouter.ts

**Testing:**
```bash
npm run build 2>&1 | tail -20
npx vitest run --reporter=verbose 2>&1 | head -50
```

**Commit:** `fix: remaining medium/low items batch`

---

## Final: E2E Testing

After all tasks are complete:
```bash
# Full build
npm run build

# Full test suite
npx vitest run --reporter=verbose

# Type check
npx tsc --noEmit

# Lint
npx next lint

# Manual smoke test the following flows:
# 1. Login (legacy + OAuth)
# 2. Dashboard loads
# 3. Create/edit/delete event
# 4. Create/edit expense
# 5. Agent chat works
# 6. Export works
# 7. 404 page shows branded design
# 8. Error boundary catches errors
```
