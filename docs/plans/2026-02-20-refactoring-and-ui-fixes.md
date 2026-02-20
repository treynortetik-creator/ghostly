# Refactoring & UI Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate duplicated utility functions, decompose the event detail god component, create API route helpers, and fix dark mode color issues.

**Architecture:** Consolidate ~50 duplicated formatCurrency/formatDate/sanitizeCurrency functions into a single `src/lib/format.ts` module. Extract API error handling and audit logging into a composable `withApiHandler` wrapper. Decompose the 1,385-line event detail page into focused tab components. Fix hardcoded colors in Button and badges for dark mode support.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Vitest

---

## Phase 1: Refactoring

### Task 1: Create shared formatting utilities and consolidate formatCurrency

**Context:** There are 23+ files with local `formatCurrency` functions and 4 files with duplicated `sanitizeCurrency`. The canonical versions exist in `src/lib/business-logic.ts` but are named differently (`formatCurrencyFixed`, `formatCurrencyDisplay`, `sanitizeCurrencyInput`). We need a clean `src/lib/format.ts` that re-exports these with friendly names and adds a compact variant (no decimals) used by dashboard cards.

**Files:**
- Create: `src/lib/format.ts`
- Modify: `src/lib/business-logic.test.ts` (add format tests)
- Modify: ALL files listed below (replace local functions with imports)

**Step 1: Write failing tests for the new format utilities**

Add to `src/lib/business-logic.test.ts`:

```typescript
import {
  formatCurrency,
  formatCurrencyCompact,
  sanitizeCurrency,
} from '../format';

describe('format utilities', () => {
  describe('formatCurrency', () => {
    it('formats positive amounts as USD with 2 decimals', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });
    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });
    it('formats negative amounts', () => {
      expect(formatCurrency(-500)).toBe('-$500.00');
    });
  });

  describe('formatCurrencyCompact', () => {
    it('formats without decimals', () => {
      expect(formatCurrencyCompact(1234.56)).toBe('$1,235');
    });
    it('formats zero', () => {
      expect(formatCurrencyCompact(0)).toBe('$0');
    });
  });

  describe('sanitizeCurrency', () => {
    it('strips non-numeric characters except decimal', () => {
      expect(sanitizeCurrency('$1,234.56')).toBe('1234.56');
    });
    it('keeps only one decimal point', () => {
      expect(sanitizeCurrency('12.34.56')).toBe('12.3456');
    });
  });
});
```

Run: `npm run test`
Expected: FAIL — `../format` does not exist

**Step 2: Create `src/lib/format.ts`**

```typescript
/**
 * Shared formatting utilities for The Counting House
 *
 * Canonical source for currency and date formatting.
 * Import from here instead of defining local helpers.
 */

// Re-export canonical sanitizer from business-logic
export { sanitizeCurrencyInput as sanitizeCurrency } from './business-logic';

/**
 * Format as USD with 2 decimal places: $1,234.56
 * Use for detail views, forms, and exact amounts.
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format as USD with no decimals: $1,235
 * Use for dashboard cards and summary views where space is tight.
 */
export function formatCurrencyCompact(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
```

Run: `npm run test`
Expected: PASS

**Step 3: Replace local formatCurrency in ALL consumer files**

For each file below, delete the local `formatCurrency` function and add `import { formatCurrency } from '@/lib/format';` (or `formatCurrencyCompact` where 0 decimals are used).

**Files using standard formatCurrency (2 decimals) — import `formatCurrency`:**
1. `src/app/events/[id]/page.tsx` (lines ~222-229)
2. `src/app/expenses/page.tsx`
3. `src/app/categories/[id]/page.tsx`
4. `src/app/import/brex/page.tsx`
5. `src/app/import/pdf/page.tsx`
6. `src/app/roi/page.tsx`
7. `src/components/events/EventCard.tsx` (lines ~54-61)
8. `src/components/events/EventList.tsx`
9. `src/components/expenses/ExpenseCard.tsx` (lines ~50-57)
10. `src/components/import/TransactionReview.tsx`
11. `src/components/import/PDFPreview.tsx`
12. `src/components/import/ImportConfirmation.tsx`
13. `src/components/export/ExportPreview.tsx`
14. `src/components/categories/CategoryList.tsx`
15. `src/components/categories/CategoryCard.tsx`
16. `src/components/dashboard/BudgetOverviewCard.tsx`
17. `src/components/dashboard/EventTypeSummary.tsx`
18. `src/components/settings/EventTypesSection.tsx`

**Files using compact formatCurrency (0 decimals) — import `formatCurrencyCompact`:**
19. `src/components/dashboard/QuarterSummary.tsx` (lines ~70-77)
20. `src/components/pipeline/KanbanCard.tsx` (lines ~34-36)

**Files with `sanitizeCurrency` duplication — replace with `import { sanitizeCurrency } from '@/lib/format'`:**
21. `src/components/expenses/ExpenseForm.tsx` (lines ~62-71)
22. `src/components/settings/EventTypeForm.tsx`
23. `src/components/events/EventForm.tsx`
24. `src/components/categories/CategoryForm.tsx`

**Step 4: Verify**

Run: `npm run test && npm run build`
Expected: All tests pass, build succeeds

**Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/business-logic.test.ts src/app/ src/components/
git commit -m "refactor: consolidate formatCurrency and sanitizeCurrency into shared format.ts"
```

---

### Task 2: Consolidate formatDate helpers

**Context:** There are 11 files with local `formatDate` functions using various format options (with/without weekday, long/short month, with/without year). Two files use `date-fns` while the rest use native `toLocaleDateString`. We should standardize on native (no extra dependency for simple formatting) and provide named variants.

**Files:**
- Modify: `src/lib/format.ts` (add date formatters)
- Modify: `src/lib/business-logic.test.ts` (add date tests)
- Modify: ALL 11 consumer files

**Step 1: Write failing tests**

Add to `src/lib/business-logic.test.ts`:

```typescript
import {
  formatDateShort,
  formatDateMedium,
  formatDateLong,
} from '../format';

describe('date formatting', () => {
  // Use a known date
  const testDate = '2026-03-15';

  describe('formatDateShort', () => {
    it('formats as "Mar 15"', () => {
      expect(formatDateShort(testDate)).toBe('Mar 15');
    });
    it('returns "—" for null', () => {
      expect(formatDateShort(null)).toBe('—');
    });
  });

  describe('formatDateMedium', () => {
    it('formats as "Mar 15, 2026"', () => {
      expect(formatDateMedium(testDate)).toBe('Mar 15, 2026');
    });
    it('returns "—" for null', () => {
      expect(formatDateMedium(null)).toBe('—');
    });
  });

  describe('formatDateLong', () => {
    it('formats with weekday like "Sun, March 15, 2026"', () => {
      expect(formatDateLong(testDate)).toBe('Sun, March 15, 2026');
    });
    it('returns "TBD" for null', () => {
      expect(formatDateLong(null)).toBe('TBD');
    });
  });
});
```

Run: `npm run test`
Expected: FAIL

**Step 2: Add date formatters to `src/lib/format.ts`**

```typescript
// ============================================
// DATE FORMATTING
// ============================================

/**
 * Short date: "Mar 15" — for compact lists and cards
 */
export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Medium date: "Mar 15, 2026" — for tables and detail fields
 */
export function formatDateMedium(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Long date: "Sun, March 15, 2026" — for event detail headers
 */
export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
```

Run: `npm run test`
Expected: PASS

**Step 3: Replace local formatDate in all consumer files**

Match each file's current format to the appropriate variant:

**Use `formatDateShort` (MMM d, no year):**
1. `src/components/documents/DocumentList.tsx` — currently "short month, day"
2. `src/components/events/EventCard.tsx` — currently "short month, day"

**Use `formatDateMedium` (MMM d, yyyy):**
3. `src/components/expenses/ExpenseCard.tsx` — currently "short month, day, year"
4. `src/components/import/TransactionReview.tsx` — currently "short month, day, year"
5. `src/components/events/EventShipmentsTab.tsx` — currently "short month, day, year"
6. `src/components/pipeline/KanbanCard.tsx` — uses date-fns `format(date, 'MMM d, yyyy')`
7. `src/components/pipeline/EventSidePanel.tsx` — uses date-fns `format(date, 'MMM d, yyyy')`

**Use `formatDateLong` (weekday, full month, d, yyyy):**
8. `src/app/events/[id]/page.tsx` — currently "short weekday, long month, day, year"
9. `src/components/events/EventRemindersTab.tsx` — currently "short weekday, long month, day, year"

**Use `formatDateMedium` (closest match, weekday not critical):**
10. `src/components/events/EventPostEventTab.tsx` — currently has weekday + short month
11. `src/components/events/EventNotesTab.tsx` — currently has weekday + short month

For files 10-11, the weekday was present but isn't essential for these contexts. If it matters, use `formatDateLong` instead. Use your judgment based on the display context.

For files 6-7 using `date-fns`: replace with `formatDateMedium` and remove the `date-fns` import if it's no longer used in that file.

**Step 4: Verify**

Run: `npm run test && npm run build`
Expected: All tests pass, build succeeds

**Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/business-logic.test.ts src/app/ src/components/
git commit -m "refactor: consolidate formatDate into shared format.ts with 3 variants"
```

---

### Task 3: Create API route error handler wrapper

**Context:** Every API route has identical boilerplate: permission check → try/catch → error logging → 500 response. The audit logging pattern (try/catch around logAudit) is also repeated 36 times. We can extract both into composable helpers that reduce each route by 10-15 lines without changing behavior.

**Files:**
- Create: `src/lib/api-helpers.ts`
- Modify: ALL API route files in `src/app/api/`

**Step 1: Create `src/lib/api-helpers.ts`**

```typescript
/**
 * API Route Helpers - DRY wrappers for common patterns
 *
 * withApiHandler: wraps a route handler with permission check + error handling
 * auditMutation: fire-and-forget audit logging without try/catch boilerplate
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PermissionScope } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';
import { logAudit, getActor, AuditParams } from '@/lib/audit';

interface ApiHandlerOptions {
  /** Required permission scope (read, write, admin) */
  permission: PermissionScope;
  /** Label for error messages, e.g. 'categories' */
  resource: string;
}

type HandlerFn = (request: NextRequest) => Promise<NextResponse>;

/**
 * Wrap an API route handler with permission check + standardized error handling.
 *
 * Usage:
 *   export const GET = withApiHandler({ permission: 'read', resource: 'categories' },
 *     async (request) => {
 *       // ... your logic, just return NextResponse
 *     }
 *   );
 */
export function withApiHandler(
  options: ApiHandlerOptions,
  handler: HandlerFn
): HandlerFn {
  return async (request: NextRequest): Promise<NextResponse> => {
    const denied = requirePermission(request, options.permission);
    if (denied) return denied;

    try {
      return await handler(request);
    } catch (error) {
      const method = request.method;
      console.error(`${options.resource} API error (${method}):`, error);
      logError(`Failed ${method} ${options.resource}`, {
        error: error as Error,
        source: `api/${options.resource}`,
        context: { method },
      });
      return NextResponse.json(
        { error: `Failed to process ${options.resource} request` },
        { status: 500 }
      );
    }
  };
}

/**
 * Fire-and-forget audit log. Swallows errors silently (logs to console).
 * Extracts actor from the request automatically.
 *
 * Usage:
 *   await auditMutation(request, {
 *     entity_type: 'category',
 *     entity_id: record.id,
 *     action: 'create',
 *   });
 */
export async function auditMutation(
  request: NextRequest,
  params: Omit<AuditParams, 'actor' | 'actor_type'>
): Promise<void> {
  try {
    const { actor, actor_type } = await getActor(request);
    logAudit({ ...params, actor, actor_type });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}
```

**Step 2: Migrate ALL API routes**

For each route file, apply these transformations:

**a) Replace the permission check + try/catch wrapper:**

Before:
```typescript
export async function GET(request: NextRequest) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    // ... business logic ...
    return NextResponse.json({ ... });
  } catch (error) {
    console.error('Categories API error:', error);
    logError('Failed to fetch categories', { error: error as Error, source: 'api/categories', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
```

After:
```typescript
export const GET = withApiHandler({ permission: 'read', resource: 'categories' },
  async (request) => {
    // ... business logic (no try/catch needed) ...
    return NextResponse.json({ ... });
  }
);
```

**b) Replace audit logging boilerplate:**

Before:
```typescript
try {
  const { actor, actor_type } = await getActor(request);
  logAudit({
    entity_type: 'category',
    entity_id: newCategory.id,
    action: 'create',
    changes: null,
    actor,
    actor_type,
  });
} catch (e) {
  console.error('Audit log failed:', e);
}
```

After:
```typescript
await auditMutation(request, {
  entity_type: 'category',
  entity_id: newCategory.id,
  action: 'create',
  changes: null,
});
```

**c) For routes using `withIdempotency`, compose them:**

```typescript
export const POST = withIdempotency(
  withApiHandler({ permission: 'write', resource: 'categories' },
    async (request) => {
      // ...
    }
  )
);
```

**API route files to migrate (check each one for GET/POST/PUT/DELETE handlers):**
- `src/app/api/api-keys/route.ts`
- `src/app/api/cadence-templates/route.ts`
- `src/app/api/categories/route.ts`
- `src/app/api/categories/[id]/route.ts`
- `src/app/api/checklist-templates/route.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/api/dashboard/roi/route.ts`
- `src/app/api/documents/route.ts`
- `src/app/api/documents/[id]/route.ts`
- `src/app/api/documents/[id]/download/route.ts`
- `src/app/api/events/route.ts`
- `src/app/api/events/[id]/route.ts`
- `src/app/api/events/[id]/checklist/route.ts`
- `src/app/api/events/[id]/documents/route.ts`
- `src/app/api/events/[id]/notes/route.ts`
- `src/app/api/events/[id]/notes/[noteId]/route.ts`
- `src/app/api/events/[id]/post-event/route.ts`
- `src/app/api/events/[id]/reminders/route.ts`
- `src/app/api/events/[id]/roi/route.ts`
- `src/app/api/events/[id]/shipments/route.ts`
- `src/app/api/events/[id]/shipments/[shipmentId]/route.ts`
- `src/app/api/events/[id]/team/route.ts`
- `src/app/api/events/[id]/team/[memberId]/route.ts`
- `src/app/api/expenses/route.ts`
- `src/app/api/expenses/[id]/route.ts`
- `src/app/api/expenses/bulk/update/route.ts`
- `src/app/api/export/route.ts`
- `src/app/api/fiscal-years/route.ts`
- `src/app/api/fiscal-years/[id]/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/import/brex/route.ts`
- `src/app/api/import/pdf/route.ts`
- `src/app/api/reminders/[rid]/sent/route.ts`
- `src/app/api/reminders/check/route.ts`
- `src/app/api/settings/event-types/route.ts`
- `src/app/api/settings/event-types/[id]/route.ts`
- `src/app/api/webhooks/route.ts`
- `src/app/api/webhooks/[id]/route.ts`

**Important:** Some routes have unique error handling (e.g., 404 for not-found). Those interior 400/404 responses stay inside the handler — only the outer try/catch and permission check get replaced. The `withApiHandler` only catches unhandled errors (500s).

**Step 3: Clean up imports**

After migration, routes should no longer directly import `requirePermission`, `logError`, or `getActor`/`logAudit` (unless they use audit for something custom). Remove unused imports.

**Step 4: Verify**

Run: `npm run test && npm run build`
Expected: All tests pass, build succeeds

**Step 5: Commit**

```bash
git add src/lib/api-helpers.ts src/app/api/
git commit -m "refactor: extract withApiHandler and auditMutation to eliminate API boilerplate"
```

---

### Task 4: Decompose Event Detail Page

**Context:** `src/app/events/[id]/page.tsx` is 1,385 lines with 11 useState hooks managing 9 tabs, ROI editing, delete confirmation, and event editing. Several tabs are already extracted (Team, Checklist, Reminders, Notes, Shipments, PostEvent, Documents) but the ROI tab (~330 lines) and Details tab (~340 lines) are still inline.

**Files:**
- Create: `src/components/events/EventROITab.tsx`
- Create: `src/components/events/EventDetailsTab.tsx`
- Modify: `src/app/events/[id]/page.tsx` (slim down dramatically)

**Step 1: Extract EventROITab**

Create `src/components/events/EventROITab.tsx` containing:
- The `roiForm` state, `isEditingROI`, `isSavingROI` state
- The `computeROIMetrics`, `roiColor`, `formatPercent`, `formatRatio` helper functions
- The ROI metrics display (4 StatCards)
- The ROI data editing form
- The save handler for ROI updates

Props interface:
```typescript
interface EventROITabProps {
  event: EventWithTotals;
  onEventUpdated: () => void; // callback to refetch after save
}
```

Import `formatCurrency` from `@/lib/format` (not a local copy).

This component should manage its own ROI-related state and call the API directly.

**Step 2: Extract EventDetailsTab**

Create `src/components/events/EventDetailsTab.tsx` containing:
- Budget section (3-column grid with budget, spent, remaining)
- Expenses list with "Add Expense" link
- Goals/objectives section
- Notes section

Props interface:
```typescript
interface EventDetailsTabProps {
  event: EventWithTotals;
  expenses: Expense[];
}
```

Import `formatCurrency` from `@/lib/format`.
Import `formatDateLong` from `@/lib/format`.

**Step 3: Slim down the main page**

The main page should now:
- Manage only: `event`, `expenses`, `isLoading`, `error`, `isEditing`, `isSaving`, `showDeleteConfirm`, `isDeleting`, `activeTab`
- Render the header, tab nav, and delegate to tab components
- No inline formatting helpers (all imported from `@/lib/format`)

The ROI-related state (`isEditingROI`, `isSavingROI`, `roiForm`) moves to EventROITab.

Target: main page drops from ~1,385 lines to ~500-600 lines.

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors

**Step 5: Commit**

```bash
git add src/components/events/EventROITab.tsx src/components/events/EventDetailsTab.tsx src/app/events/[id]/page.tsx
git commit -m "refactor: decompose event detail page into EventROITab and EventDetailsTab"
```

---

## Phase 2: UI Fixes

### Task 5: Fix dark mode hardcoded colors in Button component

**Context:** The Button component at `src/components/ui/Button.tsx` has ~15 hardcoded hex values (e.g., `#8B7355`, `bg-ink-primary`, direct color values) that don't respond to the dark theme class toggle. These need to be replaced with CSS custom property references or `dark:` Tailwind variants.

**Files:**
- Modify: `src/components/ui/Button.tsx`

**Step 1: Audit Button.tsx for hardcoded colors**

Read the file and identify every hardcoded hex value, direct `bg-*` color class, and border color that doesn't have a `dark:` counterpart.

**Step 2: Replace with themed equivalents**

For each hardcoded color:
- If it maps to an existing CSS variable (e.g., `--ink-primary`), use the Tailwind class that references it
- Add `dark:` variants for any color that doesn't adapt
- The Victorian palette in light mode should be preserved; dark mode should use the inverted palette from `globals.css`

Common mappings:
- `#8B7355` → `text-wood-dark dark:text-wood-light`
- `bg-parchment` → already has dark override in CSS
- Hard borders → add `dark:border-*` variants

**Step 3: Verify**

Run: `npm run build`
Toggle dark mode in the app and visually verify buttons look correct.

**Step 4: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "fix: Button component dark mode - replace hardcoded colors with theme-aware variants"
```

---

### Task 6: Fix dark mode hardcoded colors in badges and status indicators

**Context:** Expense source badges use raw Tailwind colors like `bg-blue-100 text-blue-800` that don't adapt to dark mode. These appear in expense cards, event cards, and list views.

**Files to audit and fix:**
- `src/components/expenses/ExpenseCard.tsx` — source badge
- `src/components/events/EventCard.tsx` — type/status badges
- `src/components/events/EventList.tsx` — inline badges
- `src/app/expenses/page.tsx` — filter badges
- `src/app/events/[id]/page.tsx` — status/type badges in header
- Any other component using raw `bg-{color}-100/200` patterns

**Step 1: Find all hardcoded badge colors**

Search for patterns like `bg-blue-100`, `bg-green-100`, `bg-red-100`, `text-blue-800`, etc. across all component files.

**Step 2: Add dark mode variants**

For each badge color, add a `dark:` counterpart:
- `bg-blue-100 text-blue-800` → add `dark:bg-blue-900/30 dark:text-blue-300`
- `bg-green-100 text-green-800` → add `dark:bg-green-900/30 dark:text-green-300`
- `bg-red-100 text-red-800` → add `dark:bg-red-900/30 dark:text-red-300`
- `bg-yellow-100 text-yellow-800` → add `dark:bg-yellow-900/30 dark:text-yellow-300`
- `bg-gray-100 text-gray-800` → add `dark:bg-gray-800/30 dark:text-gray-300`

These should be consistent across all badge uses.

**Step 3: Verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/ src/app/
git commit -m "fix: add dark mode variants to expense/event badges and status indicators"
```

---

### Task 7: Replace alert()/confirm() with inline UI

**Context:** There are 18 `alert()` calls and 11 `confirm()` calls scattered across the app. These are ugly, block the thread, and can't be styled. Replace with inline error/success messages and confirmation modals.

**Files:**
- May create: `src/components/ui/ConfirmDialog.tsx` (if one doesn't exist)
- Modify: All files using `alert()` or `confirm()`

**Step 1: Search for all alert() and confirm() usage**

Use grep to find every instance. Document the file, line, and what the alert/confirm is for.

**Step 2: Create ConfirmDialog component (if needed)**

```typescript
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}
```

Style it with the Victorian theme (parchment background, ink borders, etc.) and dark mode support.

**Step 3: Replace each alert()/confirm()**

- `alert("Success message")` → inline toast or success state that shows a styled message
- `alert("Error message")` → inline error display near the action that failed
- `confirm("Are you sure?")` → render `<ConfirmDialog>` with appropriate state management

For each file, add the necessary state (e.g., `showDeleteConfirm`) and replace the native dialog.

**Step 4: Verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx src/app/ src/components/
git commit -m "fix: replace native alert()/confirm() with styled inline UI"
```

---

### Task 8: Add ARIA attributes to event detail tabs

**Context:** The event detail page tab navigation at `src/app/events/[id]/page.tsx` uses buttons styled as tabs but lacks proper ARIA attributes (`role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`).

**Files:**
- Modify: `src/app/events/[id]/page.tsx` (tab nav section)
- Also check: any other tab patterns in the app

**Step 1: Add ARIA to tab navigation**

On the tab container div, add:
```tsx
<div role="tablist" aria-label="Event sections">
```

On each tab button, add:
```tsx
<button
  role="tab"
  aria-selected={activeTab === "details"}
  aria-controls="panel-details"
  id="tab-details"
>
```

On each tab panel, add:
```tsx
<div
  role="tabpanel"
  id="panel-details"
  aria-labelledby="tab-details"
>
```

**Step 2: Verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/events/[id]/page.tsx
git commit -m "a11y: add ARIA tablist/tab/tabpanel attributes to event detail tabs"
```

---

## Execution Order

Tasks 1-4 (refactoring) must be done sequentially because they modify overlapping files.
Tasks 5-8 (UI fixes) can proceed after refactoring is done, also sequentially to avoid conflicts.

**Total: 8 tasks, ~38 files modified, 3 files created**
