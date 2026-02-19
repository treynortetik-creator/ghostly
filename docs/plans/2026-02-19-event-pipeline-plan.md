# Event Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a calendar-first event pipeline with tier-based task auto-generation, Kanban board, and enhanced event detail to Counting House.

**Architecture:** Extends the existing checklist system (`checklist_templates` + `event_checklist_items`) with tier boolean flags and auto-generation. New `/pipeline` page with custom CSS Grid calendar and @dnd-kit Kanban board. Three new API endpoints, two extended existing routes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS 4, Supabase PostgreSQL, @dnd-kit (new), date-fns (existing)

**Design doc:** `docs/plans/2026-02-19-event-pipeline-design.md`

---

## Task 1: Migration — Pipeline Columns on Events Table

**Files:**
- Create: `supabase/migrations/020_event_pipeline.sql`

**Step 1: Write the migration**

```sql
-- 020_event_pipeline.sql
-- Add pipeline stage, tier, and shipping handler to events

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'confirmed'
    CHECK (stage IN ('confirmed','in_progress','ready','active','debrief','archived'));

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tier TEXT
    CHECK (tier IN ('executive','national_t1','national_t2','state_t1','state_t2','customer_partner'));

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS shipping_handler TEXT DEFAULT 'handler_b'
    CHECK (shipping_handler IN ('handler_a','handler_b'));

-- Index for board view (group by stage)
CREATE INDEX IF NOT EXISTS idx_events_stage ON events(stage) WHERE deleted_at IS NULL;

-- Index for calendar view (date range queries)
CREATE INDEX IF NOT EXISTS idx_events_dates ON events(date_start, date_end) WHERE deleted_at IS NULL;
```

**Step 2: Apply migration via Supabase**

Run the SQL against the database. Verify with:
```bash
# Verify columns exist
curl -s "$SUPABASE_URL/rest/v1/events?select=stage,tier,shipping_handler&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

**Step 3: Commit**
```bash
git add supabase/migrations/020_event_pipeline.sql
git commit -m "feat: add stage, tier, shipping_handler columns to events table"
```

---

## Task 2: Migration — Tier Flags and Category on Checklist Items

**Files:**
- Create: `supabase/migrations/021_checklist_tier_flags.sql`

**Step 1: Write the migration**

```sql
-- 021_checklist_tier_flags.sql
-- Add tier applicability flags and category to checklist template items
-- Add category to event checklist items

ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tier_executive BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_national_t1 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_national_t2 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_state_t1 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_state_t2 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_customer BOOLEAN DEFAULT true;

ALTER TABLE event_checklist_items
  ADD COLUMN IF NOT EXISTS category TEXT;
```

**Step 2: Apply and verify**

**Step 3: Commit**
```bash
git add supabase/migrations/021_checklist_tier_flags.sql
git commit -m "feat: add tier flags and category to checklist template items"
```

---

## Task 3: Migration — Seed 25 Pipeline Task Templates

**Files:**
- Create: `supabase/migrations/022_seed_pipeline_templates.sql`

**Step 1: Write the seed migration**

Insert one `checklist_templates` row named "Event Pipeline Tasks" with `is_default = true`.
Then insert 25 `checklist_template_items` rows with the data from the PRD task matrix.

Mapping conventions:
- `phase`: positive `days_offset` → `pre_event`, negative → `post_event`
- `default_assignee_role`: 'marketing', 'sales', 'sales_leadership', 'scrooge'
- `category`: 'planning' (research, meetings), 'logistics' (hotel, flights, shipments), 'materials' (collateral, swag), 'comms' (emails, Slack, event guides), 'post_event' (recaps, reports, follow-ups)
- `sort_order`: ordered by offset descending (earliest tasks first)

The 25 template items from the PRD:

| # | title | days_offset | default_assignee_role | category | phase | exec | nt1 | nt2 | st1 | st2 | cust |
|---|-------|-------------|----------------------|----------|-------|------|-----|-----|-----|-----|------|
| 1 | Research local events & experiences | 56 | scrooge | planning | pre_event | T | T | T | F | F | F |
| 2 | Confirm event attendees | 42 | sales_leadership | planning | pre_event | T | T | T | T | T | T |
| 3 | Confirm availability & secure hotel | 42 | marketing | logistics | pre_event | T | T | T | T | T | T |
| 4 | Collect event requirements & confirm collateral | 42 | marketing | materials | pre_event | T | T | T | T | T | T |
| 5 | Create event Slack channel | 42 | marketing | comms | pre_event | T | T | T | T | T | T |
| 6 | Source & order swag | 42 | marketing | materials | pre_event | T | T | T | T | T | T |
| 7 | Pre-event planning meeting | 42 | marketing | planning | pre_event | T | T | T | T | T | T |
| 8 | Marketing collateral (new) | 42 | marketing | materials | pre_event | T | T | F | F | F | F |
| 9 | Book flights & transportation | 28 | sales | logistics | pre_event | T | T | T | T | T | T |
| 10 | Create event guide | 28 | marketing | comms | pre_event | T | T | T | T | T | T |
| 11 | 1:1 email templates | 28 | marketing | comms | pre_event | T | T | F | T | F | F |
| 12 | Marketing email send | 28 | marketing | comms | pre_event | T | T | T | T | F | F |
| 13 | Secure dinner reservations | 21 | marketing | logistics | pre_event | T | T | F | T | F | F |
| 14 | Provide onsite team info packet | 14 | marketing | comms | pre_event | T | T | T | T | T | T |
| 15 | 2nd planning meeting | 14 | marketing | planning | pre_event | T | T | F | F | F | F |
| 16 | Submit shipment request (Monday.com) | 14 | scrooge | logistics | pre_event | T | T | F | T | F | F |
| 17 | Update SF campaign — spoke to + notes | -3 | sales | post_event | post_event | T | T | T | T | T | T |
| 18 | Complete post-event recap questionnaire | -3 | sales | post_event | post_event | T | T | T | T | T | T |
| 19 | Photos/feedback to Slack channel | -3 | sales | post_event | post_event | T | T | T | T | T | T |
| 20 | Post-event email follow-up | -7 | sales | post_event | post_event | T | T | T | T | T | T |
| 21 | Create SF reporting dashboard | -7 | marketing | post_event | post_event | T | T | T | T | T | T |
| 22 | Post-event debrief call | -7 | marketing | post_event | post_event | T | T | F | T | F | F |
| 23 | Create event finance report | -14 | scrooge | post_event | post_event | T | T | F | T | F | F |
| 24 | Document results — 30 day check | -30 | marketing | post_event | post_event | T | T | T | T | T | T |
| 25 | Document results — 60 day check | -60 | marketing | post_event | post_event | T | T | T | T | T | T |

**Step 2: Apply and verify**

Verify: `SELECT COUNT(*) FROM checklist_template_items WHERE template_id = (SELECT id FROM checklist_templates WHERE name = 'Event Pipeline Tasks');` should return 25.

**Step 3: Commit**
```bash
git add supabase/migrations/022_seed_pipeline_templates.sql
git commit -m "feat: seed 25 pipeline task templates with tier flags"
```

---

## Task 4: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Add pipeline types to interfaces**

Add to the `Event` interface (after `roi_notes`):
```typescript
stage: 'confirmed' | 'in_progress' | 'ready' | 'active' | 'debrief' | 'archived';
tier: 'executive' | 'national_t1' | 'national_t2' | 'state_t1' | 'state_t2' | 'customer_partner' | null;
shipping_handler: 'handler_a' | 'handler_b';
```

Add corresponding types:
```typescript
export type EventStage = 'confirmed' | 'in_progress' | 'ready' | 'active' | 'debrief' | 'archived';
export type EventTier = 'executive' | 'national_t1' | 'national_t2' | 'state_t1' | 'state_t2' | 'customer_partner';
export type ShippingHandler = 'handler_a' | 'handler_b';
```

Add to `ChecklistTemplateItem` interface:
```typescript
category: string | null;
tier_executive: boolean;
tier_national_t1: boolean;
tier_national_t2: boolean;
tier_state_t1: boolean;
tier_state_t2: boolean;
tier_customer: boolean;
```

Add `category: string | null;` to `EventChecklistItem` interface.

Update the `Database` type's `events` table Row/Insert/Update to include the new columns.
Update the `Database` type's `checklist_template_items` and `event_checklist_items` tables similarly.

Add display label maps:
```typescript
export const eventStageLabels: Record<EventStage, string> = {
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ready: 'Ready',
  active: 'Active',
  debrief: 'Debrief',
  archived: 'Archived',
};

export const eventTierLabels: Record<EventTier, string> = {
  executive: 'Executive',
  national_t1: 'National T1',
  national_t2: 'National T2',
  state_t1: 'State T1',
  state_t2: 'State T2',
  customer_partner: 'Customer/Partner',
};

export const tierColors: Record<EventTier, { bg: string; text: string; border: string }> = {
  executive: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  national_t1: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  national_t2: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  state_t1: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  state_t2: { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300' },
  customer_partner: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
};

// Calendar bar colors (solid backgrounds for multi-day event bars)
export const tierBarColors: Record<EventTier, string> = {
  executive: 'bg-red-500',
  national_t1: 'bg-orange-500',
  national_t2: 'bg-yellow-500',
  state_t1: 'bg-blue-500',
  state_t2: 'bg-sky-400',
  customer_partner: 'bg-green-500',
};
```

**Step 2: Run type check**
```bash
npm run build
```

**Step 3: Commit**
```bash
git add src/types/database.ts
git commit -m "feat: add pipeline types - EventStage, EventTier, tier flags, tier colors"
```

---

## Task 5: Extend PUT /api/events/[id] for Pipeline Fields

**Files:**
- Modify: `src/app/api/events/[id]/route.ts` (the PUT handler, lines ~97-266)

**Step 1: Add validation for new fields**

After the existing quarter validation block (~line 142), add:

```typescript
// Validate stage if provided
const validStages = ['confirmed', 'in_progress', 'ready', 'active', 'debrief', 'archived'];
if (body.stage !== undefined && !validStages.includes(body.stage)) {
  return NextResponse.json(
    { error: `Invalid stage. Must be one of: ${validStages.join(', ')}` },
    { status: 400 }
  );
}

// Validate tier if provided
const validTiers = ['executive', 'national_t1', 'national_t2', 'state_t1', 'state_t2', 'customer_partner'];
if (body.tier !== undefined && body.tier !== null && !validTiers.includes(body.tier)) {
  return NextResponse.json(
    { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
    { status: 400 }
  );
}

// Validate shipping_handler if provided
if (body.shipping_handler !== undefined && !['handler_a', 'handler_b'].includes(body.shipping_handler)) {
  return NextResponse.json(
    { error: 'Invalid shipping_handler. Must be "handler_a" or "handler_b"' },
    { status: 400 }
  );
}
```

**Step 2: Add fields to updateData builder**

After the existing `if (body.sales_notes !== undefined)` line (~198), add:

```typescript
if (body.stage !== undefined) updateData.stage = body.stage;
if (body.tier !== undefined) updateData.tier = body.tier;
if (body.shipping_handler !== undefined) updateData.shipping_handler = body.shipping_handler;
```

**Step 3: Add new fields to audit tracking**

In the `auditFields` array (~line 244), add: `'stage', 'tier', 'shipping_handler'`

**Step 4: Run tests and build**
```bash
npm run test && npm run build
```

**Step 5: Commit**
```bash
git add src/app/api/events/[id]/route.ts
git commit -m "feat: extend event PUT to accept stage, tier, shipping_handler"
```

---

## Task 6: Checklist Generate Endpoint

**Files:**
- Create: `src/app/api/events/[id]/checklist/generate/route.ts`

**Step 1: Implement the generate endpoint**

This endpoint:
1. Reads the event (needs tier, date_start, date_end)
2. Fetches the "Event Pipeline Tasks" template items filtered by the event's tier
3. Checks which template_item_ids are already on the event (dedup)
4. Inserts new items with calculated due_dates
5. Returns the newly created items

Pattern: Follow `src/app/api/events/[id]/checklist/route.ts` (the POST handler) for auth, audit, and error patterns.

Key logic:
```typescript
// Tier flag column mapping
const tierColumnMap: Record<string, string> = {
  executive: 'tier_executive',
  national_t1: 'tier_national_t1',
  national_t2: 'tier_national_t2',
  state_t1: 'tier_state_t1',
  state_t2: 'tier_state_t2',
  customer_partner: 'tier_customer',
};

// Due date calculation
function calculateDueDate(daysOffset: number, dateStart: string | null, dateEnd: string | null): string | null {
  if (daysOffset > 0 && dateStart) {
    return subDays(parseISO(dateStart), daysOffset).toISOString().split('T')[0];
  }
  if (daysOffset < 0 && dateEnd) {
    return addDays(parseISO(dateEnd), Math.abs(daysOffset)).toISOString().split('T')[0];
  }
  if (daysOffset < 0 && dateStart) {
    // Fallback: use dateStart if no dateEnd
    return addDays(parseISO(dateStart), Math.abs(daysOffset)).toISOString().split('T')[0];
  }
  return null;
}
```

Response should include `{ message, items_added, items_skipped, items }`.

**Step 2: Run build to verify**
```bash
npm run build
```

**Step 3: Commit**
```bash
git add src/app/api/events/[id]/checklist/generate/route.ts
git commit -m "feat: add checklist generate endpoint for tier-based pipeline task creation"
```

---

## Task 7: Calendar API Endpoint

**Files:**
- Create: `src/app/api/events/calendar/route.ts`

**Step 1: Implement GET /api/events/calendar**

Query params: `month=YYYY-MM` (required)

Logic:
1. Parse month param, compute date range (first day of month to last day of month, with padding for events that overlap month boundaries)
2. Query events where `date_start <= end_of_month AND date_end >= start_of_month` (OR date_start falls within month for events with no end date). Filter `deleted_at IS NULL`.
3. For each event, fetch task counts from `event_checklist_items`: total, completed (completed_at IS NOT NULL), overdue (due_date < today AND completed_at IS NULL)
4. Also return a `task_dates` map: `{ [YYYY-MM-DD]: { count, tasks: [{ title, event_name, event_id }] } }` for task markers

Follow the pattern from `src/app/api/events/route.ts` — use `requirePermission(request, 'read')`, same error handling.

Response shape:
```typescript
{
  events: Array<{
    id, name, date_start, date_end, location, tier, stage, budget_amount,
    event_type_record: { name } | null,
    task_counts: { total, completed, overdue },
    actual_spent, remaining
  }>,
  task_dates: Record<string, { count: number, tasks: Array<{ id, title, event_name, event_id, due_date }> }>,
  month: string  // echo back YYYY-MM
}
```

**Step 2: Build check**
```bash
npm run build
```

**Step 3: Commit**
```bash
git add src/app/api/events/calendar/route.ts
git commit -m "feat: add calendar API endpoint with event ranges and task date markers"
```

---

## Task 8: Board API Endpoint

**Files:**
- Create: `src/app/api/events/board/route.ts`

**Step 1: Implement GET /api/events/board**

Query all non-deleted, non-archived events. Group by stage. For each event include:
- Basic fields (id, name, date_start, date_end, location, tier, stage, budget_amount)
- event_type_record (joined)
- task_counts: { total, completed }
- actual_spent, remaining (from expenses aggregation — same pattern as events GET)
- days_until: computed from date_start

Follow the same expense aggregation pattern from `src/app/api/events/route.ts` (lines 131-151).

Response shape:
```typescript
{
  stages: {
    confirmed: EventCard[],
    in_progress: EventCard[],
    ready: EventCard[],
    active: EventCard[],
    debrief: EventCard[]
  },
  totals: { confirmed: number, in_progress: number, ready: number, active: number, debrief: number }
}
```

**Step 2: Build check and commit**
```bash
npm run build
git add src/app/api/events/board/route.ts
git commit -m "feat: add board API endpoint with events grouped by pipeline stage"
```

---

## Task 9: Install @dnd-kit + Add Pipeline Nav Item

**Files:**
- Modify: `src/components/layout/AppShell.tsx` (line 29-39, navItems array)

**Step 1: Install @dnd-kit**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Add Pipeline nav item**

In `AppShell.tsx`, add to the `navItems` array (after Events, before Categories):
```typescript
{ name: "Pipeline", href: "/pipeline", icon: GitBranch },
```

Import `GitBranch` from `lucide-react` (or `Workflow` — whichever fits the Victorian vibe better).

**Step 3: Build check and commit**
```bash
npm run build
git add package.json package-lock.json src/components/layout/AppShell.tsx
git commit -m "feat: add @dnd-kit dependency and Pipeline nav item"
```

---

## Task 10: Pipeline Page with View Toggle

**Files:**
- Create: `src/app/(pages)/pipeline/page.tsx`
- Create: `src/components/pipeline/ViewToggle.tsx`

**Step 1: Build ViewToggle component**

Simple tab bar with Calendar | Board options. Matches the Victorian styling — use the same active state pattern as nav items (bg-wood-medium, text-ink-gold).

**Step 2: Build Pipeline page**

Server component that renders a client wrapper. The client component:
- Holds state: `view` ('calendar' | 'board'), `currentMonth` (Date)
- Fetches data from `/api/events/calendar` or `/api/events/board` based on view
- Renders ViewToggle + month navigation (for calendar) + the active view component
- Loading states with skeleton placeholders

Page title: "The Pipeline" (Victorian themed)

**Step 3: Build check and commit**
```bash
npm run build
git add src/app/\(pages\)/pipeline/ src/components/pipeline/
git commit -m "feat: pipeline page scaffold with calendar/board view toggle"
```

---

## Task 11: Custom Calendar Grid Component

**Files:**
- Create: `src/components/pipeline/CalendarGrid.tsx`
- Create: `src/components/pipeline/CalendarHelpers.ts`

**Step 1: Build CalendarHelpers utility**

Pure functions for calendar math:
```typescript
// Get all dates for a calendar month grid (includes padding days from prev/next months)
export function getCalendarDays(year: number, month: number): Date[]
// week rows from calendar days
export function getWeekRows(days: Date[]): Date[][]
// Check if event overlaps a specific date
export function eventSpansDate(event: { date_start: string | null; date_end: string | null }, date: Date): boolean
// Calculate event bar positioning within a week row
export function calculateEventBars(events: CalendarEvent[], weekDates: Date[]): EventBarPosition[]
```

The `calculateEventBars` function is the core complexity. For each week row:
1. Filter events that overlap any date in this week
2. For each event, calculate: startCol (0-6), endCol (0-6), whether it continues from previous week, whether it continues to next week
3. Assign vertical slots to avoid overlaps (greedy top-down allocation)
4. Cap at 3 visible slots + "+N more" count

**Step 2: Build CalendarGrid component**

Props: `{ events, taskDates, currentMonth, viewMode: 'month' | 'week' }`

Renders:
- Day-of-week header row (Sun-Sat)
- For month view: 5-6 week rows via CSS Grid
- Each cell: date number, task markers, event bars rendered absolutely positioned across cells
- Greyed-out dates outside the current month
- Today highlighted with gold border

CSS Grid approach:
- Outer grid: 7 columns, N rows
- Event bars: absolutely positioned within a relative container per row, spanning columns via `grid-column: start / end`

**Step 3: Build check and commit**
```bash
npm run build
git add src/components/pipeline/CalendarGrid.tsx src/components/pipeline/CalendarHelpers.ts
git commit -m "feat: custom calendar grid with multi-day event bar positioning"
```

---

## Task 12: EventBar, TaskMarker, TaskPopover Components

**Files:**
- Create: `src/components/pipeline/EventBar.tsx`
- Create: `src/components/pipeline/TaskMarker.tsx`
- Create: `src/components/pipeline/TaskPopover.tsx`

**Step 1: EventBar component**

Renders the colored multi-day block. Props: position data from CalendarHelpers.
- Background color from `tierBarColors` map
- Rounded ends (left rounded if event starts this week, right rounded if it ends this week, flat if it continues)
- Event name truncated with ellipsis
- Click handler to open side panel
- Height: ~24px, stacked with 2px gap

**Step 2: TaskMarker component**

Small circular badge on a calendar date. Shows count of tasks due on that date.
- Gold circle with number
- Positioned in the bottom area of the cell
- Click toggles the TaskPopover

**Step 3: TaskPopover component**

Dropdown/popover shown on TaskMarker click. Lists tasks due on that date:
- Task title
- Event name (with tier color dot)
- Owner role
- Completion status (checkbox or strikethrough if done)

Use absolute positioning relative to the calendar cell. Close on click-outside.

**Step 4: Build check and commit**
```bash
npm run build
git add src/components/pipeline/EventBar.tsx src/components/pipeline/TaskMarker.tsx src/components/pipeline/TaskPopover.tsx
git commit -m "feat: calendar event bars, task markers, and task popover"
```

---

## Task 13: Event Side Panel

**Files:**
- Create: `src/components/pipeline/EventSidePanel.tsx`

**Step 1: Build slide-out panel**

Triggered by clicking an event bar on the calendar. Slides in from the right.
- Fixed position, z-50, width ~400px
- Backdrop overlay (click to close)
- Parchment background, wood-tone border

Content:
- Event name (Playfair Display heading)
- Date range formatted nicely
- Location
- Tier badge (colored pill)
- Stage badge
- Budget: progress bar showing actual vs budget
- Team members (if any assigned)
- Task completion: "12/18 complete" with progress bar
- "View Full Details →" link to `/events/[id]`
- Close button (X)

**Step 2: Wire up to CalendarGrid**

Add `selectedEventId` state to the Pipeline page. Pass event click handler down to CalendarGrid → EventBar. Conditionally render EventSidePanel.

**Step 3: Build check and commit**
```bash
npm run build
git add src/components/pipeline/EventSidePanel.tsx
git commit -m "feat: event side panel for calendar view"
```

---

## Task 14: Kanban Board Components

**Files:**
- Create: `src/components/pipeline/KanbanBoard.tsx`
- Create: `src/components/pipeline/KanbanColumn.tsx`
- Create: `src/components/pipeline/KanbanCard.tsx`

**Step 1: KanbanCard component**

Renders a single event as a card. Props: event data from board API.
- Card with parchment background, subtle shadow
- Event name (bold), date range, location
- Tier badge (colored pill, same as calendar)
- Budget bar: mini progress bar with "$ actual / $budget"
- Task completion: "12/18" with mini bar
- Countdown: "in 12 days" (green), "TODAY" (gold), "3 days ago" (red)
- Click navigates to `/events/[id]`
- Draggable via @dnd-kit `useSortable` or `useDraggable`

**Step 2: KanbanColumn component**

Renders one stage column. Props: stage name, events array, isOver (drop target).
- Header with stage name + event count
- Wood-tone header bar, parchment body
- Vertical scrollable card list
- Visual feedback when dragging over (subtle border glow)
- @dnd-kit `useDroppable`

**Step 3: KanbanBoard component**

Container for 5 columns. Manages @dnd-kit context.
- `DndContext` wrapping all columns
- `onDragEnd` handler: extract event ID and new stage from drop event, call `PUT /api/events/[id]` with `{ stage: newStage }`
- Optimistic update: move card in local state immediately, revert on API error
- Horizontal layout: flex row with equal columns, horizontal scroll on small screens

**Step 4: Wire up to Pipeline page**

When `view === 'board'`, fetch from `/api/events/board` and render KanbanBoard.

**Step 5: Build check and commit**
```bash
npm run build
git add src/components/pipeline/KanbanBoard.tsx src/components/pipeline/KanbanColumn.tsx src/components/pipeline/KanbanCard.tsx
git commit -m "feat: kanban board with drag-and-drop stage transitions"
```

---

## Task 15: Enhance Event Detail — Tier Badge + Shipping Indicator

**Files:**
- Modify: `src/app/(pages)/events/[id]/page.tsx` (the event detail page)

**Step 1: Add tier badge to header**

In the event detail header area, after the event name / event type display, add:
- Tier badge: colored pill using `tierColors` map from database.ts. Only show if `event.tier` is set.
- Shipping indicator: small text/icon showing "Handler A" or "Handler B" based on `event.shipping_handler`.

These should be subtle — small badges next to existing header elements.

**Step 2: Build check and commit**
```bash
npm run build
git add src/app/\(pages\)/events/\[id\]/page.tsx
git commit -m "feat: add tier badge and shipping indicator to event detail header"
```

---

## Task 16: Enhance Checklist Tab — Filters + Generate Button

**Files:**
- Modify: `src/components/checklist/EventChecklistTab.tsx`

**Step 1: Add "Generate Pipeline Tasks" button**

At the top of the checklist tab, alongside the existing "Apply Template" and "Add Task" buttons, add a "Generate Pipeline Tasks" button.

On click:
1. Call `POST /api/events/[id]/checklist/generate`
2. Show loading state
3. On success: show toast/message "Generated N tasks", refresh the checklist
4. If event has no tier: show warning "Set event tier first to generate pipeline tasks"

**Step 2: Add category filter pills**

Above the phase-grouped checklist sections, add a row of filter pills:
- All | Planning | Logistics | Materials | Comms | Post-Event
- Click a pill → filter displayed items by category
- "All" shows everything (including manual items with no category)
- Filter is client-side only (data already fetched)

**Step 3: Add owner_role filter**

Second row of filters or combined with category:
- All | Marketing | Sales | Sales Leadership | Scrooge
- Filters by `default_assignee_role` on the items

**Step 4: Build check and commit**
```bash
npm run build
git add src/components/checklist/EventChecklistTab.tsx
git commit -m "feat: add generate button and category/role filters to checklist tab"
```

---

## Task 17: Final Verification

**Step 1: Run full test suite**
```bash
npm run test
```

**Step 2: Run build**
```bash
npm run build
```

**Step 3: Run lint**
```bash
npm run lint
```

**Step 4: Manual smoke test checklist**
- [ ] Navigate to /pipeline — calendar renders with current month
- [ ] Events show as colored bars spanning their date ranges
- [ ] Click event bar → side panel slides in with event details
- [ ] Task markers appear on dates with tasks due
- [ ] Click task marker → popover shows task list
- [ ] Month navigation (prev/next) works
- [ ] Switch to Board view — 5 Kanban columns render
- [ ] Event cards show in correct stage columns
- [ ] Drag card between columns → stage updates
- [ ] Navigate to /events/[id] — tier badge and shipping indicator visible
- [ ] Checklist tab shows "Generate Pipeline Tasks" button
- [ ] Generate button creates tasks filtered by tier
- [ ] Category and role filters work on checklist
- [ ] Existing events list at /events still works
- [ ] All other features (expenses, import, export, etc.) unaffected

**Step 5: Commit any fixes, then final commit**
```bash
git add -A
git commit -m "feat: event pipeline - calendar, kanban board, tier-based task generation"
```

---

## Dependency Graph

```
Task 1 (events migration) ──┐
Task 2 (checklist migration) ├── Task 4 (types) ── Task 5 (PUT extend)
Task 3 (seed templates) ─────┘                  ├── Task 6 (generate endpoint)
                                                 ├── Task 7 (calendar API)
                                                 └── Task 8 (board API)
                                                      │
Task 9 (install dnd-kit + nav) ──────────────────────┤
                                                      │
Tasks 10-13 (calendar UI) ───────────────────────────┤ (can parallel with API tasks)
Task 14 (kanban UI) ─────────────────────────────────┤
Task 15 (event detail tier) ─────────────────────────┤
Task 16 (checklist enhance) ─────────────────────────┘
                                                      │
                                                 Task 17 (verification)
```

**Parallelizable tasks:**
- Tasks 1-3 (migrations) can run together
- Tasks 7 + 8 (API endpoints) can run in parallel after Task 4
- Tasks 11-13 (calendar sub-components) can run in parallel
- Task 14 (kanban) is independent of Tasks 11-13
- Tasks 15 + 16 (event detail) are independent of each other
