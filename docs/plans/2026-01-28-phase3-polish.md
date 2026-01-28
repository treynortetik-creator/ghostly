# Phase 3: P2 Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tests, remove dead code, add pagination, fix currency handling, and add optimistic UI updates to the Counting House app.

**Architecture:** Extract testable pure functions from route handlers into `src/lib/` utilities. Delete mock-data, relocate types/labels to `src/types/`. Add pagination via Supabase `.range()`. Fix currency with `Math.round(amount * 100)` for comparisons and `.toFixed(2)` for display. Add optimistic updates to expense delete/edit flows.

**Tech Stack:** Vitest, Next.js 16, React 19, Supabase, TypeScript

---

## Task 1: Set Up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add vitest dep + test script)
- Modify: `tsconfig.json` (if path aliases need config)

**Step 1: Install vitest**

```bash
npm install -D vitest
```

**Step 2: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 3: Add test script to package.json**

Add `"test": "vitest run"` to scripts.

**Step 4: Verify vitest runs**

```bash
npm test
```

Expected: exits with "no test files found" or similar (no tests yet).

**Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: set up vitest test runner"
```

---

## Task 2: Extract Pure Functions for Testing

The CSV parser, duplicate detection, and validation logic are currently embedded in API route files. Extract them into `src/lib/` so they can be tested without importing Next.js route machinery.

**Files:**
- Create: `src/lib/csv-parser.ts` (from `src/app/api/import/brex/route.ts` lines 63-206)
- Create: `src/lib/duplicate-detection.ts` (from `src/app/api/import/brex/route.ts` lines 215-249)
- Create: `src/lib/validation.ts` (common validation helpers)
- Create: `src/lib/currency.ts` (currency formatting and comparison)
- Modify: `src/app/api/import/brex/route.ts` (import from new modules)

**Step 1: Create `src/lib/csv-parser.ts`**

Extract `parseBrexCSV()` and `parseCSVLine()` from `src/app/api/import/brex/route.ts`. Export types `ParsedBrexTransaction` too.

```typescript
// src/lib/csv-parser.ts

export interface ParsedBrexTransaction {
  id: string;
  date: string;
  amount: number;
  originalAmount: number;
  originalCurrency: string;
  vendor: string;
  memo: string | null;
  expenseStatus: string;
  paymentStatus: string;
}

export function parseCSVLine(line: string): string[] {
  // ... exact copy from route.ts lines 176-206
}

export function parseBrexCSV(csvContent: string): ParsedBrexTransaction[] {
  // ... exact copy from route.ts lines 63-171
}
```

**Step 2: Create `src/lib/duplicate-detection.ts`**

Extract `findDuplicate()` and the `DuplicateInfo` type.

```typescript
// src/lib/duplicate-detection.ts

export interface DuplicateInfo {
  id: string;
  date: string;
  vendor: string;
  amount: number;
}

export interface ExistingExpense {
  id: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
}

export function findDuplicate(
  transaction: { amount: number; date: string; vendor: string },
  existingExpenses: ExistingExpense[]
): DuplicateInfo | undefined {
  // ... exact copy from route.ts lines 224-248
}
```

**Step 3: Create `src/lib/validation.ts`**

Extract validation patterns used across routes.

```typescript
// src/lib/validation.ts

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateFormat(date: string): boolean {
  return DATE_REGEX.test(date);
}

export function isValidAmount(value: unknown): value is number {
  const amount = typeof value === 'string' ? parseFloat(value) : value;
  return typeof amount === 'number' && !isNaN(amount) && amount > 0;
}

export function sanitizeVendorForSearch(vendor: string): string {
  return vendor.replace(/[%_\\]/g, '\\$&');
}

export const VALID_EVENT_TYPES = ['executive', 'national', 'state', 'regional', 'customer'] as const;
export const VALID_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'] as const;
export const VALID_SOURCE_TYPES = ['manual', 'brex', 'pdf'] as const;

export function isValidEventType(type: string): boolean {
  return (VALID_EVENT_TYPES as readonly string[]).includes(type);
}

export function isValidQuarter(quarter: string): boolean {
  return (VALID_QUARTERS as readonly string[]).includes(quarter);
}

export function isValidSourceType(source: string): boolean {
  return (VALID_SOURCE_TYPES as readonly string[]).includes(source);
}
```

**Step 4: Create `src/lib/currency.ts`**

```typescript
// src/lib/currency.ts

/** Convert amount to integer cents for safe comparison */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Compare two currency amounts for equality (cent-precision) */
export function currencyEquals(a: number, b: number): boolean {
  return toCents(a) === toCents(b);
}

/** Format amount for display with 2 decimal places */
export function formatCurrencyDisplay(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format amount for export/data (no locale, just fixed decimals) */
export function formatCurrencyExport(amount: number): string {
  return amount.toFixed(2);
}
```

**Step 5: Update `src/app/api/import/brex/route.ts`**

Replace inline functions with imports:
```typescript
import { parseBrexCSV, type ParsedBrexTransaction } from '@/lib/csv-parser';
import { findDuplicate, type DuplicateInfo } from '@/lib/duplicate-detection';
```

Remove the inline `parseBrexCSV`, `parseCSVLine`, `findDuplicate`, `ParsedBrexTransaction`, and `DuplicateInfo` definitions. Keep only the `TransactionWithSuggestion` type and the POST handler.

**Step 6: Verify build**

```bash
npm run build
```

**Step 7: Commit**

```bash
git add src/lib/csv-parser.ts src/lib/duplicate-detection.ts src/lib/validation.ts src/lib/currency.ts src/app/api/import/brex/route.ts
git commit -m "refactor: extract pure functions into testable modules"
```

---

## Task 3: Write Unit Tests (15+ tests)

**Files:**
- Create: `src/lib/__tests__/csv-parser.test.ts`
- Create: `src/lib/__tests__/duplicate-detection.test.ts`
- Create: `src/lib/__tests__/validation.test.ts`
- Create: `src/lib/__tests__/currency.test.ts`

**Step 1: Write CSV parser tests** (`src/lib/__tests__/csv-parser.test.ts`)

Tests to write:
1. `parseCSVLine` - basic comma-separated values
2. `parseCSVLine` - quoted fields with commas inside
3. `parseCSVLine` - escaped quotes (doubled)
4. `parseBrexCSV` - valid Brex CSV with standard headers
5. `parseBrexCSV` - MM/DD/YYYY date conversion to YYYY-MM-DD
6. `parseBrexCSV` - amount parsing strips $ and commas
7. `parseBrexCSV` - skips rows with missing required fields
8. `parseBrexCSV` - throws on missing header row
9. `parseBrexCSV` - throws on missing required columns

**Step 2: Run tests to verify they pass**

```bash
npm test
```

**Step 3: Write duplicate detection tests** (`src/lib/__tests__/duplicate-detection.test.ts`)

Tests:
10. Finds exact match (same amount, date, vendor)
11. Finds match with bidirectional vendor substring
12. Returns undefined when no match
13. Amount tolerance within threshold (cents-level matching)
14. No match when vendor differs completely

**Step 4: Write validation tests** (`src/lib/__tests__/validation.test.ts`)

Tests:
15. `isValidDateFormat` accepts YYYY-MM-DD
16. `isValidDateFormat` rejects MM/DD/YYYY and other formats
17. `sanitizeVendorForSearch` escapes %, _, \
18. `isValidAmount` rejects NaN, zero, negative

**Step 5: Write currency tests** (`src/lib/__tests__/currency.test.ts`)

Tests:
19. `toCents` converts correctly (19.99 -> 1999)
20. `currencyEquals` handles floating point (0.1 + 0.2 vs 0.3)
21. `formatCurrencyExport` always has 2 decimal places

**Step 6: Run all tests**

```bash
npm test
```

Expected: All 15+ tests pass.

**Step 7: Commit**

```bash
git add src/lib/__tests__/
git commit -m "test: add unit tests for CSV parsing, validation, duplicate detection, and currency"
```

---

## Task 4: Remove Dead Mock Data

**Files:**
- Delete: `src/lib/mock-data/index.ts`
- Delete: `src/lib/mock-data/events.ts`
- Delete: `src/lib/mock-data/categories.ts`
- Delete: `src/lib/mock-data/expenses.ts`
- Delete: `src/lib/mock-data/settings.ts`
- Modify: `src/types/database.ts` — add `EventWithTotals`, `CategoryWithTotals` interfaces (currently in mock files)
- Create: `src/lib/labels.ts` — move `eventTypeLabels`, `quarterLabels`, `sourceTypeLabels`, `sourceTypeBadgeColors`
- Modify: `src/app/api/export/preview/route.ts` — rewrite to use Supabase instead of mock data
- Modify: 16 component/page files that import types or labels from mock-data

**Step 1: Add types to `src/types/database.ts`**

Add to the end of the file (before the Database interface):
```typescript
/** Event with computed budget totals */
export interface EventWithTotals extends Event {
  actual_spent: number;
  remaining: number;
  expense_count: number;
}

/** Budget category with computed totals */
export interface CategoryWithTotals extends BudgetCategory {
  actual_spent: number;
  remaining: number;
  expense_count: number;
}
```

Note: `ExpenseWithRelations` is already in `src/types/database.ts`.

**Step 2: Create `src/lib/labels.ts`**

```typescript
import type { EventType, QuarterType, ExpenseSource } from '@/types/database';

export const eventTypeLabels: Record<EventType, string> = {
  executive: 'Executive',
  national: 'National',
  state: 'State',
  regional: 'Regional',
  customer: 'Customer',
};

export const quarterLabels: Record<QuarterType, string> = {
  Q1: 'Q1 (Jan–Mar)',
  Q2: 'Q2 (Apr–Jun)',
  Q3: 'Q3 (Jul–Sep)',
  Q4: 'Q4 (Oct–Dec)',
  TBD: 'TBD',
};

export const sourceTypeLabels: Record<ExpenseSource, string> = {
  manual: 'Manual Entry',
  brex: 'Brex Import',
  pdf: 'PDF Upload',
};

export const sourceTypeBadgeColors: Record<ExpenseSource, string> = {
  manual: 'bg-sepia/15 text-sepia border-sepia/30',
  brex: 'bg-ink-green/15 text-ink-green border-ink-green/30',
  pdf: 'bg-ink-gold/15 text-ink-gold border-ink-gold/30',
};
```

**Step 3: Update all import references**

For each file that imports from `@/lib/mock-data/*`:

| File | Old Import | New Import |
|------|-----------|------------|
| `src/components/categories/CategoryCard.tsx` | `type { CategoryWithTotals } from '@/lib/mock-data/categories'` | `type { CategoryWithTotals } from '@/types/database'` |
| `src/components/categories/CategoryList.tsx` | `type { CategoryWithTotals } from '@/lib/mock-data/categories'` | `type { CategoryWithTotals } from '@/types/database'` |
| `src/components/events/EventCard.tsx` | `type { EventWithTotals } from '@/lib/mock-data/events'` + `{ eventTypeLabels }` | `type { EventWithTotals } from '@/types/database'` + `{ eventTypeLabels } from '@/lib/labels'` |
| `src/components/events/EventList.tsx` | `type { EventWithTotals } from '@/lib/mock-data/events'` | `type { EventWithTotals } from '@/types/database'` |
| `src/components/events/EventFilters.tsx` | `{ eventTypeLabels, quarterLabels } from '@/lib/mock-data/events'` | `{ eventTypeLabels, quarterLabels } from '@/lib/labels'` |
| `src/components/events/EventForm.tsx` | `{ eventTypeLabels, quarterLabels } from '@/lib/mock-data/events'` | `{ eventTypeLabels, quarterLabels } from '@/lib/labels'` |
| `src/components/expenses/ExpenseFilters.tsx` | `{ sourceTypeLabels } from '@/lib/mock-data/expenses'` | `{ sourceTypeLabels } from '@/lib/labels'` |
| `src/components/expenses/ExpenseForm.tsx` | `{ sourceTypeLabels } from '@/lib/mock-data/expenses'` | `{ sourceTypeLabels } from '@/lib/labels'` |
| `src/components/expenses/ExpenseCard.tsx` | `type { ExpenseWithRelations } from '@/lib/mock-data/expenses'` | `type { ExpenseWithRelations } from '@/types/database'` |
| `src/components/expenses/ExpenseList.tsx` | `type { ExpenseWithRelations } from '@/lib/mock-data/expenses'` | `type { ExpenseWithRelations } from '@/types/database'` |
| `src/app/categories/page.tsx` | `type { CategoryWithTotals } from '@/lib/mock-data/categories'` | `type { CategoryWithTotals } from '@/types/database'` |
| `src/app/categories/[id]/page.tsx` | `type { CategoryWithTotals } from '@/lib/mock-data/categories'` | `type { CategoryWithTotals } from '@/types/database'` |
| `src/app/events/page.tsx` | `type { EventWithTotals } from '@/lib/mock-data/events'` | `type { EventWithTotals } from '@/types/database'` |
| `src/app/events/[id]/page.tsx` | `type { EventWithTotals } from '@/lib/mock-data/events'` + `{ eventTypeLabels, quarterLabels }` | `type { EventWithTotals } from '@/types/database'` + `{ eventTypeLabels, quarterLabels } from '@/lib/labels'` |
| `src/app/expenses/page.tsx` | `type { ExpenseWithRelations } from '@/lib/mock-data/expenses'` | `type { ExpenseWithRelations } from '@/types/database'` |

**Step 4: Rewrite `src/app/api/export/preview/route.ts`**

Replace mock data imports with Supabase queries. This route currently uses `getEventsWithTotals()`, `getCategoriesWithTotals()`, and `getExpenses()` from mock data. Rewrite to query Supabase directly, matching the pattern used in the events and categories GET routes.

**Step 5: Delete mock data files**

```bash
rm -rf src/lib/mock-data/
```

**Step 6: Verify build**

```bash
npm run build
```

**Step 7: Run tests**

```bash
npm test
```

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove dead mock data, relocate types and labels"
```

---

## Task 5: Add Pagination to List Endpoints

**Files:**
- Modify: `src/app/api/expenses/route.ts` (GET handler)
- Modify: `src/app/api/events/route.ts` (GET handler)
- Modify: `src/app/api/categories/route.ts` (GET handler)

**Pagination pattern for all three:**

Add `page` and `per_page` query params. Default: `page=1, per_page=50`. Use Supabase `.range()` for offset pagination. Return pagination metadata.

**Step 1: Update expenses GET**

Parse new params:
```typescript
const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));
```

Before executing the query, get the count:
```typescript
// Add { count: 'exact' } to the select
let query = supabase
  .from('expenses')
  .select('*, events(name), budget_categories(name)', { count: 'exact' })
  .is('deleted_at', null);
```

After applying all filters and sort, add range:
```typescript
const from = (page - 1) * perPage;
const to = from + perPage - 1;
query = query.range(from, to);
```

Update response to include pagination metadata:
```typescript
const total = count ?? 0;
return NextResponse.json({
  expenses,
  meta: {
    total,
    total_amount: totalAmount,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
    filters_applied: filters,
    sort: { by: sortBy, order: sortOrder },
  },
});
```

Note: `total_amount` will now be the amount for the current page only. For the full total across all pages, a separate count query would be needed, but the task says to just add pagination — keep it simple.

**Step 2: Update events GET**

Same pattern. The events route currently fetches all events and all expenses, then computes totals in JS. Keep this approach but paginate the final `events` array after sorting:

```typescript
const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));

// After sorting events array:
const total = events.length;
const from = (page - 1) * perPage;
const paginatedEvents = events.slice(from, from + perPage);

return NextResponse.json({
  events: paginatedEvents,
  meta: {
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
    filters_applied: filters,
  },
});
```

**Step 3: Update categories GET**

Same pattern as events — paginate the final computed array:

```typescript
const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '50', 10)));

const total = categories.length;
const from = (page - 1) * perPage;
const paginatedCategories = categories.slice(from, from + perPage);

return NextResponse.json({
  categories: paginatedCategories,
  meta: {
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
    filters_applied: filters,
  },
});
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Run tests**

```bash
npm test
```

**Step 6: Commit**

```bash
git add src/app/api/expenses/route.ts src/app/api/events/route.ts src/app/api/categories/route.ts
git commit -m "feat: add pagination to events, expenses, and categories list endpoints"
```

---

## Task 6: Fix Currency Handling

**Files:**
- Modify: `src/lib/duplicate-detection.ts` — use `toCents()` for comparison
- Modify: `src/app/api/export/csv/route.ts` — use `formatCurrencyExport()`
- Modify: `src/app/expenses/page.tsx` — use `formatCurrencyDisplay()` with 2 decimal places
- Modify: any component using `toLocaleString` for currency — ensure `minimumFractionDigits: 2`

**Step 1: Update duplicate detection to use integer cents**

In `src/lib/duplicate-detection.ts`, replace:
```typescript
const amountMatch = Math.abs(exp.amount - transaction.amount) < 0.01;
```
with:
```typescript
import { toCents } from './currency';
const amountMatch = toCents(exp.amount) === toCents(transaction.amount);
```

**Step 2: Update currency display in expenses page**

In `src/app/expenses/page.tsx`, the `formatCurrency` function uses `minimumFractionDigits: 0`. Change to `minimumFractionDigits: 2`:
```typescript
const formatCurrency = (amount: number) => {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
```

**Step 3: Check and fix other currency display locations**

Search all components for `toLocaleString` currency formatting and ensure they all use `minimumFractionDigits: 2`.

**Step 4: Update CSV export to use `.toFixed(2)`**

In `src/app/api/export/csv/route.ts`, verify the `formatCurrency` helper uses `.toFixed(2)` (it already does per exploration).

**Step 5: Verify build + tests**

```bash
npm run build && npm test
```

**Step 6: Commit**

```bash
git add src/lib/duplicate-detection.ts src/app/expenses/page.tsx
git commit -m "fix: use integer cents for currency comparison, ensure 2 decimal display"
```

---

## Task 7: Add Optimistic UI Updates

**Files:**
- Modify: `src/app/expenses/page.tsx` — optimistic delete and bulk delete

**Step 1: Optimistic single delete**

In `handleDeleteExpense`, update UI before the API call and rollback on error:

```typescript
const handleDeleteExpense = async (expense: ExpenseWithRelations) => {
  if (!confirm(`Are you sure you wish to delete this expense from ${expense.vendor || 'Unknown Vendor'}?`)) {
    return;
  }

  // Optimistic: remove from UI immediately
  const previousExpenses = expenses;
  setExpenses(prev => prev.filter(e => e.id !== expense.id));

  try {
    const response = await fetch(`/api/expenses/${expense.id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      // Rollback on failure
      setExpenses(previousExpenses);
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete expense');
    }
  } catch (err) {
    // Rollback on error
    setExpenses(previousExpenses);
    alert(err instanceof Error ? err.message : 'Failed to delete expense');
  }
};
```

**Step 2: Optimistic bulk delete**

Same pattern for `handleBulkDeleteExpenses`:

```typescript
const handleBulkDeleteExpenses = async (expensesToDelete: ExpenseWithRelations[]) => {
  if (expensesToDelete.length === 0) return;

  const confirmMsg = expensesToDelete.length === 1
    ? 'Are you sure you wish to delete this expense?'
    : `Are you sure you wish to delete ${expensesToDelete.length} expenses?`;

  if (!confirm(confirmMsg)) return;

  // Optimistic: remove all from UI immediately
  const previousExpenses = expenses;
  const deleteIds = new Set(expensesToDelete.map(e => e.id));
  setExpenses(prev => prev.filter(e => !deleteIds.has(e.id)));

  try {
    const results = await Promise.all(
      expensesToDelete.map(expense =>
        fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
      )
    );

    const failedCount = results.filter(r => !r.ok).length;
    if (failedCount > 0) {
      // Partial failure — refetch to get accurate state
      setExpenses(previousExpenses);
      alert(`Failed to delete ${failedCount} expense(s). Please try again.`);
    }
  } catch (err) {
    // Rollback on network error
    setExpenses(previousExpenses);
    alert(err instanceof Error ? err.message : 'Failed to delete expenses');
  }
};
```

**Step 3: Verify build + tests**

```bash
npm run build && npm test
```

**Step 4: Commit**

```bash
git add src/app/expenses/page.tsx
git commit -m "feat: add optimistic UI updates for expense delete operations"
```

---

## Task 8: Final Verification

**Step 1: Run build**

```bash
npm run build
```

**Step 2: Run tests**

```bash
npm test
```

**Step 3: Push all commits**

```bash
git push
```
