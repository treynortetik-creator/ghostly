# Refactoring Audit - The Counting House
## Date: 2026-02-20

## Executive Summary

The Counting House codebase is well-structured for a ~90-file Next.js app, with solid patterns around auth, permissions, and audit logging. However, there are significant opportunities to reduce duplication -- most critically, **`formatCurrency` is redefined 22+ times** across components and pages, `sanitizeCurrency` is duplicated 4 times (despite an existing shared version in `business-logic.ts`), and every API route repeats the same 8-line error handling + audit logging boilerplate. The event detail page at 1,385 lines is a god component that should be decomposed. Addressing these issues would eliminate ~2,000+ lines of duplicated code and significantly improve maintainability.

---

## High Priority Refactoring Opportunities

### 1. Extract Shared `formatCurrency` Utility (The Biggest Win)
- **Impact:** High
- **Effort:** Low
- **Files affected:** 22+ files containing local `formatCurrency` definitions
- **Description:** `formatCurrency` is defined as a local function in **22+ separate files**. There are at least 3 variants:
  - `minimumFractionDigits: 0, maximumFractionDigits: 0` (no decimals) -- used in `QuarterSummary.tsx` line 70, `KanbanCard.tsx` line 34
  - `minimumFractionDigits: 2, maximumFractionDigits: 2` (2 decimals) -- used in most components
  - `amount.toFixed(2)` (export format) -- `export-helpers.ts` line 78, `business-logic.ts` line 151

  A `formatCurrencyDisplay` already exists in `/src/lib/business-logic.ts` line 158 but **none of the 22+ component/page files use it**. They all redefine their own copy.

- **Specific files with local `formatCurrency`:**
  - `/src/components/dashboard/QuarterSummary.tsx` (line 70)
  - `/src/components/dashboard/EventTypeSummary.tsx` (line 70)
  - `/src/components/dashboard/BudgetOverviewCard.tsx` (line 32)
  - `/src/components/categories/CategoryCard.tsx` (line 40)
  - `/src/components/categories/CategoryList.tsx` (line 67)
  - `/src/components/expenses/ExpenseCard.tsx` (line 50)
  - `/src/components/expenses/ExpenseList.tsx` (line 246)
  - `/src/components/events/EventCard.tsx` (line 54)
  - `/src/components/events/EventList.tsx` (line 174)
  - `/src/components/import/TransactionReview.tsx` (line 141)
  - `/src/components/import/ImportConfirmation.tsx` (line 92)
  - `/src/components/import/PDFPreview.tsx` (line 108)
  - `/src/components/export/ExportPreview.tsx` (line 63)
  - `/src/components/settings/EventTypesSection.tsx` (line 164)
  - `/src/components/pipeline/KanbanCard.tsx` (line 34)
  - `/src/app/events/[id]/page.tsx` (line 222)
  - `/src/app/expenses/page.tsx` (line 277)
  - `/src/app/categories/[id]/page.tsx` (line 145)
  - `/src/app/roi/page.tsx` (line 103)
  - `/src/app/import/pdf/page.tsx` (line 277)
  - `/src/app/import/brex/page.tsx` (line 227)

- **Recommendation:** Create a `/src/lib/format.ts` utility:
  ```typescript
  // /src/lib/format.ts
  export function formatCurrency(amount: number, decimals: 0 | 2 = 2): string {
    return amount.toLocaleString('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  export function formatDate(dateStr: string | null, options?: Intl.DateTimeFormatOptions): string {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-US', options ?? {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }
  ```
  Then search-and-replace all 22+ local definitions. Estimated savings: **~120 lines of duplicated function definitions** plus reduced cognitive load.

---

### 2. Extract Shared `sanitizeCurrency` (Already Exists, Not Used)
- **Impact:** Medium
- **Effort:** Low
- **Files affected:** 4 component files + `business-logic.ts`
- **Description:** `sanitizeCurrencyInput` already exists in `/src/lib/business-logic.ts` (line 96), is tested (line 108), but **4 form components redefine it locally as `sanitizeCurrency`:**
  - `/src/components/expenses/ExpenseForm.tsx` (line 62)
  - `/src/components/events/EventForm.tsx` (line 54)
  - `/src/components/categories/CategoryForm.tsx` (line 43)
  - `/src/components/settings/EventTypeForm.tsx` (line 44)

  All 4 copies are identical, and they replicate the logic from `business-logic.ts`.

- **Recommendation:** Import `sanitizeCurrencyInput` from `@/lib/business-logic` in all 4 files. Delete the local copies. Net change: 4 files, ~40 lines removed.

---

### 3. Decompose Event Detail Page (1,385 lines, God Component)
- **Impact:** High
- **Effort:** Medium
- **Files affected:** `/src/app/events/[id]/page.tsx`
- **Description:** This file is the largest in the codebase at **1,385 lines** with **11 useState hooks**, at least 4 fetch calls, inline ROI editing, delete confirmation, budget display, expense listing, and 9 tabs. It has:
  - `formatCurrency` (redefined locally, line 222)
  - `formatDate` (redefined locally, line 231)
  - `formatDateRange` (line 241)
  - `computeROIMetrics` (line 252)
  - ROI form state management (lines 97-106, 137-172)
  - Budget overview rendering (lines ~700-1000)
  - Expense table rendering (lines ~1150-1210)
  - Delete confirmation dialog (inline)

- **Recommendation:** Extract into sub-components:
  1. `EventBudgetSection` -- budget progress, stats cards (~150 lines)
  2. `EventROISection` -- ROI display/edit form (~200 lines)
  3. `EventExpenseTable` -- expense listing with totals (~100 lines)
  4. `EventHeader` -- back link, badges, action buttons (~80 lines)
  5. Move `computeROIMetrics` to `/src/lib/business-logic.ts` (it's pure logic)
  6. Use shared `formatCurrency` and `formatDate` from `/src/lib/format.ts`

  Target: reduce from 1,385 lines to ~400 lines for the page component, with 4-5 new focused sub-components.

---

### 4. API Route Error Handling Boilerplate
- **Impact:** High
- **Effort:** Medium
- **Files affected:** 61+ API route files (102 occurrences of `logError('Failed to`)
- **Description:** Every single API route handler follows this identical pattern:
  ```typescript
  } catch (err) {
    console.error('Descriptive error:', err);
    logError('Failed to do thing', { error: err as Error, source: 'api/route-name', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to do thing' },
      { status: 500 }
    );
  }
  ```
  This 5-line block appears **102 times across 61 files**. The `console.error` call is redundant because `logError` already calls `console.error` internally (see `/src/lib/error-logger.ts` line 57).

- **Recommendation:** Create a `withErrorHandler` wrapper or a `handleApiError` utility:
  ```typescript
  // /src/lib/api-utils.ts
  export function handleApiError(err: unknown, message: string, source: string, method: string): NextResponse {
    logError(message, { error: err as Error, source, context: { method } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
  ```
  Replace `} catch (err) { console.error(...); logError(...); return NextResponse.json(...); }` with `} catch (err) { return handleApiError(err, 'Failed to...', 'api/route', 'GET'); }` across all 61 files. Saves ~200+ lines and eliminates the redundant `console.error` calls.

---

### 5. API Route Audit Logging Boilerplate
- **Impact:** Medium
- **Effort:** Medium
- **Files affected:** 29 API route files with mutation handlers (36 occurrences)
- **Description:** Every mutation handler wraps audit logging in an identical try/catch:
  ```typescript
  // Audit log (non-blocking)
  try {
    const { actor, actor_type } = await getActor(request);
    logAudit({
      entity_type: 'expense',
      entity_id: newExpense.id,
      action: 'create',
      changes: null,
      actor,
      actor_type,
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
  ```
  This 10-12 line block appears in **29 files, 36 times**. The `getActor` + `logAudit` + try/catch is always the same shape.

- **Recommendation:** Add a convenience method to `/src/lib/audit.ts`:
  ```typescript
  export async function auditAction(
    request: NextRequest,
    params: Omit<AuditParams, 'actor' | 'actor_type'>
  ): Promise<void> {
    try {
      const { actor, actor_type } = await getActor(request);
      await logAudit({ ...params, actor, actor_type });
    } catch (e) {
      console.error('Audit log failed:', e);
    }
  }
  ```
  Replace all 36 occurrences with:
  ```typescript
  auditAction(request, { entity_type: 'expense', entity_id: id, action: 'create', changes: null });
  ```
  Saves ~250+ lines and standardizes the pattern.

---

## Medium Priority

### 6. Shared `formatDate` Utility
- **Impact:** Medium
- **Effort:** Low
- **Files affected:** 10+ component files
- **Description:** `new Date(dateStr).toLocaleDateString('en-US', {...})` is redefined as a local function in **10 separate component files**, each with slightly different options:
  - `/src/components/events/EventCard.tsx` (line 65)
  - `/src/components/events/EventShipmentsTab.tsx` (line 85)
  - `/src/components/events/EventNotesTab.tsx` (line 49)
  - `/src/components/events/EventPostEventTab.tsx` (line 43)
  - `/src/components/events/EventRemindersTab.tsx` (line 53)
  - `/src/components/expenses/ExpenseCard.tsx` (line 60)
  - `/src/components/documents/DocumentList.tsx` (line 36)
  - `/src/components/dashboard/UpcomingReminders.tsx` (line 22)
  - `/src/components/import/TransactionReview.tsx` (line 149)
  - `/src/app/events/[id]/page.tsx` (line 231)

- **Recommendation:** Add to the proposed `/src/lib/format.ts` with named presets:
  ```typescript
  export const DATE_FORMATS = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' },
    compact: { month: 'numeric', day: 'numeric' },
  } as const;
  ```

---

### 7. Shared `getStatusColor` Pattern
- **Impact:** Medium
- **Effort:** Low
- **Files affected:** 4 component files
- **Description:** The budget status color logic (over budget = red, >=80% = gold, else green) is duplicated in:
  - `/src/components/dashboard/QuarterSummary.tsx` (line 79)
  - `/src/components/dashboard/EventTypeSummary.tsx` (line 79)
  - `/src/components/dashboard/BudgetOverviewCard.tsx` (line 41)
  - `/src/components/ui/ProgressBar.tsx` (line 214)

  All four use the same thresholds and color names (`text-ink-red`, `text-ink-gold`, `text-ink-green`).

- **Recommendation:** Extract to `/src/lib/format.ts`:
  ```typescript
  export function getBudgetStatusColor(actual: number, budget: number): string {
    if (actual > budget) return 'text-ink-red';
    if (budget > 0 && (actual / budget) >= 0.80) return 'text-ink-gold';
    return 'text-ink-green';
  }
  ```

---

### 8. Shared Form CSS Classes
- **Impact:** Medium
- **Effort:** Low
- **Files affected:** 6 files
- **Description:** The same multi-line Tailwind class strings for `inputClasses`, `labelClasses`, and `errorClasses` are duplicated across all form components:
  - `/src/components/expenses/ExpenseForm.tsx` (lines 177-188)
  - `/src/components/events/EventForm.tsx` (lines 186-198)
  - `/src/components/categories/CategoryForm.tsx`
  - `/src/components/settings/EventTypeForm.tsx`
  - `/src/components/expenses/ExpenseFilters.tsx`
  - `/src/app/settings/cadence/page.tsx`

- **Recommendation:** Extract to a shared constants file `/src/components/ui/form-classes.ts`:
  ```typescript
  export const inputClasses = `w-full px-4 py-2.5 rounded-md bg-parchment border border-wood-medium/40 ...`;
  export const labelClasses = 'block text-sm font-medium text-wood-dark mb-1.5';
  export const errorClasses = 'text-xs text-ink-red mt-1';
  ```
  Or better yet, create shared `<FormInput>`, `<FormLabel>`, `<FormError>` components.

---

### 9. `modified_after` Validation Duplication
- **Impact:** Medium
- **Effort:** Low
- **Files affected:** 8+ API route files
- **Description:** The `modified_after` parameter validation block is repeated verbatim in multiple GET handlers:
  ```typescript
  if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
    return NextResponse.json(
      { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
      { status: 400 }
    );
  }
  ```
  Found in: `expenses/route.ts`, `events/route.ts`, `categories/route.ts`, `team/route.ts`, `documents/route.ts`, `checklist-templates/route.ts`, plus more.

- **Recommendation:** Extract to `/src/lib/api-utils.ts`:
  ```typescript
  export function validateModifiedAfter(value: string | null): NextResponse | null {
    if (value && isNaN(Date.parse(value))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }
    return null;
  }
  ```

---

### 10. Event-to-WithTotals Mapping Duplication
- **Impact:** Medium
- **Effort:** Medium
- **Files affected:** 7 API route files under `/src/app/api/events/`
- **Description:** The pattern of destructuring `event_types` from a Supabase join result and remapping to `event_type_record`, plus null-coalescing all nullable numeric fields (`budget_amount ?? 0`, `pipeline_generated ?? 0`, etc.), appears in **7 event-related API routes** with 26 occurrences of the `?? 0` pattern:
  - `/src/app/api/events/route.ts` (lines 155-171, 337-350)
  - `/src/app/api/events/[id]/route.ts` (lines 62-79, 250-268)
  - `/src/app/api/events/[id]/roi/route.ts`
  - `/src/app/api/events/upcoming/route.ts`
  - `/src/app/api/events/calendar/route.ts`
  - `/src/app/api/events/board/route.ts`
  - `/src/app/api/dashboard/roi/route.ts`

- **Recommendation:** Extract a `mapEventToWithTotals` function in `/src/lib/api-utils.ts` or `/src/lib/business-logic.ts`:
  ```typescript
  export function mapEventToWithTotals(rawEvent: any, stats: { total: number; count: number }): EventWithTotals {
    const { event_types, ...eventData } = rawEvent;
    return {
      ...eventData,
      event_type_record: event_types ?? null,
      budget_amount: rawEvent.budget_amount ?? 0,
      // ... all the other ?? 0 fields
      actual_spent: stats.total,
      remaining: (rawEvent.budget_amount ?? 0) - stats.total,
      expense_count: stats.count,
    };
  }
  ```

---

### 11. Expense-to-WithRelations Mapping Duplication
- **Impact:** Low-Medium
- **Effort:** Low
- **Files affected:** 3 files
- **Description:** The pattern of destructuring `events`/`budget_categories` joins and mapping to `event_name`/`category_name`/`target_type`/`target_name` is duplicated:
  - `/src/app/api/expenses/route.ts` (lines 215-224)
  - `/src/app/api/expenses/[id]/route.ts` (lines 49-56, lines 216-223)

- **Recommendation:** Extract a `mapExpenseWithRelations` utility.

---

### 12. No Custom Hooks Directory
- **Impact:** Medium
- **Effort:** Medium
- **Files affected:** All page components
- **Description:** There is no `/src/hooks/` directory. Every page component implements its own data fetching with identical patterns:
  ```typescript
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/...');
      if (!response.ok) throw new Error('...');
      const data = await response.json();
      setData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  ```
  This exact pattern (with minor variations) appears in:
  - `/src/app/events/page.tsx`
  - `/src/app/events/[id]/page.tsx`
  - `/src/app/expenses/page.tsx`
  - `/src/app/categories/page.tsx`
  - `/src/app/categories/[id]/page.tsx`
  - `/src/app/roi/page.tsx`
  - `/src/app/team/page.tsx`
  - `/src/app/settings/page.tsx`

- **Recommendation:** Create `/src/hooks/useApiData.ts`:
  ```typescript
  export function useApiData<T>(url: string) {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => { ... }, [url]);
    useEffect(() => { refresh(); }, [refresh]);

    return { data, isLoading, error, refresh, setData };
  }
  ```
  This would eliminate ~30 lines of boilerplate per page component across 8+ pages.

---

## Low Priority / Nice-to-Have

### 13. `data-oid` Attribute Pollution
- **Impact:** Low (cosmetic / bundle size)
- **Effort:** Low (automated)
- **Files affected:** All component files (1,463 total occurrences in `/src/components/`)
- **Description:** There are **1,463 `data-oid` attributes** scattered throughout component JSX. These appear to be auto-generated tracking IDs (possibly from a visual editing tool). They add noise to the codebase, increase bundle size slightly, and make code harder to read.
- **Recommendation:** Either:
  - Strip them all with a regex find-and-replace (safe, they serve no runtime purpose)
  - Add a build plugin to strip them in production

---

### 14. API Key Validation Duplication (Middleware vs Auth)
- **Impact:** Low
- **Effort:** Low
- **Files affected:** `/src/middleware.ts`, `/src/lib/auth.ts`
- **Description:** API key validation logic exists in two places:
  - `validateApiKeyInMiddleware` in `/src/middleware.ts` (line 73) -- uses Web Crypto API (Edge-compatible)
  - `validateApiKey` in `/src/lib/auth.ts` (line 181) -- uses Node.js `crypto` module

  Both do the same thing (hash key, query Supabase, check expiration, update `last_used_at`) but use different crypto APIs due to runtime constraints. The middleware version is the one actually used in the request flow.

- **Recommendation:** This is somewhat unavoidable due to Edge vs Node runtime differences, but the `validateApiKey` in `auth.ts` appears to be dead code now that middleware handles it. Consider removing it or marking it as "Node-only fallback."

---

### 15. `EventWithTotals` Type Defined Twice
- **Impact:** Low
- **Effort:** Low
- **Files affected:** `/src/types/database.ts` (line 473), `/src/app/api/events/route.ts` (line 17)
- **Description:** `EventWithTotals` interface is defined in `database.ts` as a proper type extending `Event`, but `events/route.ts` redefines a local `EventWithTotals` interface (lines 17-45) that is essentially the same but defined inline. Similarly, `categories/route.ts` redefines `CategoryWithTotals` (lines 16-28) which also exists in `database.ts` (line 483).
- **Recommendation:** Import from `database.ts` in both route files, delete the local definitions.

---

### 16. Pagination Logic Duplication
- **Impact:** Low
- **Effort:** Low
- **Files affected:** 5+ API route files
- **Description:** Pagination parameter parsing is repeated:
  ```typescript
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  ```
  Found in: `expenses/route.ts`, `categories/route.ts`, `events/route.ts`, `documents/route.ts`, etc.

- **Recommendation:** Extract to `/src/lib/api-utils.ts`:
  ```typescript
  export function parsePagination(searchParams: URLSearchParams, defaults = { perPage: 50, maxPerPage: 200 }) { ... }
  ```

---

### 17. `export-helpers.ts` Has Redundant `formatCurrency`
- **Impact:** Low
- **Effort:** Low
- **Files affected:** `/src/lib/export-helpers.ts`
- **Description:** `/src/lib/export-helpers.ts` line 78 defines `formatCurrency(amount)` which is literally `amount.toFixed(2)` -- identical to `formatCurrencyFixed` which it already re-exports from `business-logic.ts` on line 6.
- **Recommendation:** Remove `formatCurrency` from `export-helpers.ts` and use `formatCurrencyFixed` directly.

---

### 18. Consider Server Components for Data-Heavy Pages
- **Impact:** Low-Medium (performance)
- **Effort:** High
- **Files affected:** All page files (14 "use client" page files)
- **Description:** All 14 page files are client components (`"use client"`) that fetch data via `useEffect` + `fetch('/api/...')`. This means:
  - Every page requires a client-side round-trip for data
  - No benefit from Next.js server-side rendering or streaming
  - Loading states must be managed manually

  For a single-user app deployed on Railway, this is not a major performance issue, but it does mean the app always shows a loading spinner on navigation.

- **Recommendation:** Low priority given the single-user nature, but for pages that don't need heavy interactivity (like the dashboard), converting to server components with Suspense would eliminate loading spinners and reduce JavaScript shipped to the client.

---

## Code Metrics

- **Total API routes:** 67 (route.ts files)
- **Total components:** 58 (.tsx files in /src/components/)
- **Total source files (TS + TSX):** ~130
- **Total source lines:** ~39,394

### Largest Files (Top 10)
| File | Lines | Notes |
|------|-------|-------|
| `/src/types/database.ts` | 1,668 | Type definitions -- unavoidable size for Supabase schema |
| `/src/app/events/[id]/page.tsx` | 1,385 | **God component -- highest priority to decompose** |
| `/src/app/settings/cadence/page.tsx` | 847 | Inline CRUD for cadence templates |
| `/src/app/admin/page.tsx` | 801 | Admin dashboard |
| `/src/app/settings/page.tsx` | 729 | Settings page |
| `/src/components/import/TransactionReview.tsx` | 662 | Complex import review UI |
| `/src/app/import/pdf/page.tsx` | 652 | PDF import flow |
| `/src/components/expenses/ExpenseList.tsx` | 609 | Expense listing with sorting |
| `/src/app/import/brex/page.tsx` | 609 | Brex import flow |
| `/src/app/categories/[id]/page.tsx` | 599 | Category detail page |

### Most Duplicated Patterns
| Pattern | Occurrences | Files |
|---------|-------------|-------|
| Local `formatCurrency` function | 22+ | 22+ component/page files |
| API error handling (catch + logError + return 500) | 102 | 61 API route files |
| API audit logging (try { getActor + logAudit } catch) | 36 | 29 API route files |
| Local `formatDate` / `toLocaleDateString` helper | 10+ | 10+ component files |
| `modified_after` validation block | 8+ | 8+ API route files |
| Local `sanitizeCurrency` function | 4 | 4 form components |
| `inputClasses` / `labelClasses` / `errorClasses` constants | 6 | 6 form files |
| Pagination parsing (`page`, `perPage`, `from`, `to`) | 5+ | 5+ API route files |
| `data-oid` attributes | 1,463 | All component files |
| Event-to-WithTotals mapping (`event_types` destructuring + `?? 0`) | 7 | 7 event API routes |

---

## Recommended Refactoring Order

Priority ordering balances ROI (lines saved / effort) with risk:

1. **Create `/src/lib/format.ts`** with shared `formatCurrency`, `formatDate`, `getBudgetStatusColor` -- touches only imports, zero logic risk, saves ~150 lines (Items #1, #6, #7)

2. **Replace local `sanitizeCurrency` with import from `business-logic.ts`** -- 4 files, already tested, zero risk (Item #2)

3. **Create `handleApiError` utility** and replace error catch blocks across API routes -- mechanical replacement, saves ~200 lines (Item #4)

4. **Create `auditAction` convenience method** in `audit.ts` -- saves ~250 lines across 29 route files (Item #5)

5. **Extract shared form classes** to constants or components -- 6 files, low risk (Item #8)

6. **Extract `validateModifiedAfter` and `parsePagination`** to api-utils -- low risk, incremental (Items #9, #16)

7. **Decompose event detail page** into sub-components -- biggest single file improvement, medium risk (Item #3)

8. **Create `useApiData` hook** for standardized data fetching -- medium risk, 8+ pages affected (Item #12)

9. **Extract `mapEventToWithTotals`** helper for event API routes (Item #10)

10. **Clean up type duplication** (local `EventWithTotals` in route files, redundant `formatCurrency` in export-helpers) (Items #15, #17)

11. **Strip `data-oid` attributes** -- automated, cosmetic improvement (Item #13)

---

## Notes for Implementation

- Items #1-#6 are all safe, mechanical refactors that can be done in a single session with find-and-replace. They carry near-zero risk of introducing bugs.
- Item #7 (event detail page decomposition) should be done carefully with testing against the existing UI behavior.
- Item #12 (useApiData hook) changes the data fetching pattern across the app and should be done page-by-page.
- None of these refactors require database changes or API contract changes.
- The existing test file (`business-logic.test.ts`, 34 tests) covers the shared business logic. Adding the new shared utilities to this test file would be valuable.
