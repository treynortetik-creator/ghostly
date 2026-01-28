# Supabase Migration: Events, Categories & Expenses

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all mock data reads/writes in API routes with real Supabase queries so data persists across deploys and page refreshes.

**Architecture:** Each API route currently imports from `@/lib/mock-data/*` and operates on in-memory arrays. We replace those imports with `createClient()` from `@/lib/supabase/server` and use Supabase's PostgREST client for all CRUD. The mock data files remain as fallback/reference but are no longer imported by API routes. The dashboard summary route also needs migration since it reads from the same mock arrays.

**Tech Stack:** Next.js App Router, Supabase JS (SSR client), TypeScript, PostgREST

**Current state:** Supabase already has 45 events, 5 budget categories, 0 expenses. Tables match the TypeScript types in `src/types/database.ts`. Settings and fiscal years APIs are already on Supabase (reference pattern in `src/app/api/settings/route.ts`).

---

## Task 1: Migrate Events List & Create (`/api/events`)

**File:** `src/app/api/events/route.ts`

**What changes:**
- Remove mock data imports (`mockEvents`, `mockFiscalYear`, `getEvents`, `allExpenses`)
- Import `createClient` from `@/lib/supabase/server`
- Keep `type EventWithTotals` import from mock (it's just a type) OR define inline
- GET: Query `events` table with filters, left-join expenses for totals
- POST: Insert into `events` table, return the created row

**GET handler replacement:**
```typescript
const supabase = await createClient();

let query = supabase
  .from('events')
  .select('*')
  .is('deleted_at', null);

if (filters.event_type) query = query.eq('event_type', filters.event_type);
if (filters.quarter) query = query.eq('quarter', filters.quarter);
if (filters.fiscal_year_id) query = query.eq('fiscal_year_id', filters.fiscal_year_id);

const { data: rawEvents, error } = await query.order('date_start', { ascending: true, nullsFirst: false });

if (error) throw error;

// For each event, get expense totals
const events: EventWithTotals[] = [];
for (const event of rawEvents || []) {
  const { data: expenseData } = await supabase
    .from('expenses')
    .select('amount')
    .eq('event_id', event.id)
    .is('deleted_at', null);

  const actualSpent = (expenseData || []).reduce((sum, e) => sum + e.amount, 0);
  events.push({
    ...event,
    budget_amount: event.budget_amount ?? 0,
    expansion_goal: event.expansion_goal ?? 0,
    net_new_goal: event.net_new_goal ?? 0,
    actual_spent: actualSpent,
    remaining: (event.budget_amount ?? 0) - actualSpent,
    expense_count: (expenseData || []).length,
  });
}
```

**POST handler replacement:**
```typescript
const supabase = await createClient();

const { data: newEvent, error } = await supabase
  .from('events')
  .insert({
    name: body.name,
    event_type: body.event_type,
    quarter: body.quarter,
    fiscal_year_id: body.fiscal_year_id || null,
    date_start: body.date_start || null,
    date_end: body.date_end || null,
    location: body.location || null,
    budget_amount: budgetAmount,
    expansion_goal: parseInt(body.expansion_goal) || 0,
    net_new_goal: parseInt(body.net_new_goal) || 0,
    approach_notes: body.approach_notes || null,
    marketing_notes: body.marketing_notes || null,
    sales_notes: body.sales_notes || null,
  })
  .select()
  .single();

if (error) throw error;

// Return with totals (new event has 0 expenses)
return NextResponse.json({
  ...newEvent,
  actual_spent: 0,
  remaining: newEvent.budget_amount ?? 0,
  expense_count: 0,
}, { status: 201 });
```

**Verify:** Build passes, creating an event persists after refresh.

**Commit:** `feat: migrate events list/create API to Supabase`

---

## Task 2: Migrate Events Detail (`/api/events/[id]`)

**File:** `src/app/api/events/[id]/route.ts`

**What changes:**
- Remove mock data imports
- Import `createClient`
- GET: Query single event + its expenses from Supabase
- PUT: Update event row in Supabase
- DELETE: Soft-delete (set `deleted_at`) in Supabase

**GET handler key query:**
```typescript
const supabase = await createClient();

const { data: event, error } = await supabase
  .from('events')
  .select('*')
  .eq('id', id)
  .is('deleted_at', null)
  .single();

if (error || !event) {
  return NextResponse.json({ error: 'Event not found' }, { status: 404 });
}

const { data: expenses } = await supabase
  .from('expenses')
  .select('*')
  .eq('event_id', id)
  .is('deleted_at', null)
  .order('expense_date', { ascending: false });

const actualSpent = (expenses || []).reduce((sum, e) => sum + e.amount, 0);

// Also fetch fiscal year
const { data: fiscalYear } = await supabase
  .from('fiscal_years')
  .select('*')
  .eq('id', event.fiscal_year_id)
  .single();
```

**PUT handler key query:**
```typescript
const { data: updated, error } = await supabase
  .from('events')
  .update({
    name: body.name ?? existingEvent.name,
    // ... all fields
    updated_at: new Date().toISOString(),
  })
  .eq('id', id)
  .is('deleted_at', null)
  .select()
  .single();
```

**DELETE handler key query:**
```typescript
const { error } = await supabase
  .from('events')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id);
```

**Verify:** Build passes, event detail page loads from DB, edits persist.

**Commit:** `feat: migrate events detail API to Supabase`

---

## Task 3: Migrate Categories List & Create (`/api/categories`)

**File:** `src/app/api/categories/route.ts`

**Same pattern as Task 1** but for `budget_categories` table.

**Verify:** Build passes, categories list loads from DB, new categories persist.

**Commit:** `feat: migrate categories list/create API to Supabase`

---

## Task 4: Migrate Categories Detail (`/api/categories/[id]`)

**File:** `src/app/api/categories/[id]/route.ts`

**Same pattern as Task 2** but for `budget_categories` table.

**Verify:** Build passes, category detail loads, edits persist, delete works.

**Commit:** `feat: migrate categories detail API to Supabase`

---

## Task 5: Migrate Expenses List & Create (`/api/expenses`)

**File:** `src/app/api/expenses/route.ts`

**What changes:**
- Remove mock data imports
- GET: Query expenses with filters, join event/category names
- POST: Insert into expenses table, validate event/category exists via DB query

**GET handler - key difference from events:**
- Needs to join event name and category name for the `ExpenseWithRelations` shape
- Supports more filters (date range, vendor search, source_type)
- Has sort support

```typescript
const supabase = await createClient();

let query = supabase
  .from('expenses')
  .select('*, events(name), budget_categories(name)')
  .is('deleted_at', null);

if (filters.event_id) query = query.eq('event_id', filters.event_id);
if (filters.category_id) query = query.eq('category_id', filters.category_id);
if (filters.date_start) query = query.gte('expense_date', filters.date_start);
if (filters.date_end) query = query.lte('expense_date', filters.date_end);
if (filters.vendor) query = query.ilike('vendor', `%${filters.vendor}%`);
if (filters.source_type) query = query.eq('source_type', filters.source_type);

// Sort
const ascending = sortOrder === 'asc';
switch (sortBy) {
  case 'amount': query = query.order('amount', { ascending }); break;
  case 'vendor': query = query.order('vendor', { ascending }); break;
  default: query = query.order('expense_date', { ascending }); break;
}

const { data: rawExpenses, error } = await query;
if (error) throw error;

// Map to ExpenseWithRelations shape
const expenses = (rawExpenses || []).map(e => ({
  ...e,
  event_name: e.events?.name || null,
  category_name: e.budget_categories?.name || null,
  target_type: e.event_id ? 'event' : 'category',
  target_name: e.events?.name || e.budget_categories?.name || 'Unknown',
  events: undefined,
  budget_categories: undefined,
}));
```

**POST handler:** Validate event/category exists via Supabase query instead of `getEventById()`.

**Verify:** Build passes, expenses page loads from DB, creating expense persists.

**Commit:** `feat: migrate expenses list/create API to Supabase`

---

## Task 6: Migrate Expenses Detail (`/api/expenses/[id]`)

**File:** `src/app/api/expenses/[id]/route.ts`

**Same pattern** - GET/PUT/DELETE all go through Supabase.

**Verify:** Build passes, expense detail/edit/delete works.

**Commit:** `feat: migrate expenses detail API to Supabase`

---

## Task 7: Migrate Dashboard Summary (`/api/dashboard/summary`)

**File:** `src/app/api/dashboard/summary/route.ts`

**What changes:**
- Remove mock data imports (`mockEvents`, `mockCategories`, `allExpenses`)
- Query all active events, categories, and expenses from Supabase
- Compute the same byEventType, byQuarter, byCategory aggregations

```typescript
const supabase = await createClient();

const [
  { data: activeEvents },
  { data: activeCategories },
  { data: activeExpenses },
] = await Promise.all([
  supabase.from('events').select('*').is('deleted_at', null),
  supabase.from('budget_categories').select('*').is('deleted_at', null),
  supabase.from('expenses').select('*').is('deleted_at', null),
]);
```

Then the same aggregation logic already in the file, just operating on DB results instead of mock arrays.

**Verify:** Build passes, dashboard shows real data.

**Commit:** `feat: migrate dashboard summary API to Supabase`

---

## Task 8: Migrate Brex Import Routes

**Files:**
- `src/app/api/import/brex/route.ts` - Uses `getEventsWithTotals()`, `getCategoriesWithTotals()`, `getExpenses()` for duplicate detection and AI categorization targets
- `src/app/api/import/brex/confirm/route.ts` - Uses `getEventById()`, `getCategoryById()`, `allExpenses` for validation and expense creation

**What changes:**
- Replace mock data lookups with Supabase queries
- The confirm route needs to actually INSERT expenses into Supabase (currently commented out)
- Replace action needs to UPDATE `deleted_at` on existing expense via Supabase

**Verify:** Build passes. CSV upload + confirm creates expenses in Supabase.

**Commit:** `feat: migrate brex import routes to Supabase`

---

## Task 9: Build verification & push

- Run full build (`npm run build`)
- Verify no remaining mock data imports in API routes (grep for `mock-data` in `src/app/api/`)
- Push to main for Railway deployment
- Test on deployed app: create event, verify it persists after refresh

**Commit:** N/A (just verification)

---

## Notes

- **EventWithTotals type:** Currently defined in `src/lib/mock-data/events.ts`. Should either move to `src/types/database.ts` or keep importing from mock file (it's just a type, no runtime dependency). Cleaner to move it.
- **CategoryWithTotals type:** Same situation, defined in `src/lib/mock-data/categories.ts`.
- **Mock data files are NOT deleted** - they still hold the hardcoded event/category definitions which are useful as reference. They just won't be imported by API routes anymore.
- **No RLS changes** in this migration - tables currently have RLS disabled. That's a separate concern.
- **The PDF import route** (`/api/import/pdf`) only parses PDFs and doesn't read/write mock data for expenses, so it doesn't need migration.
