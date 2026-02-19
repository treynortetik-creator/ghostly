# Design: Counting House Event Pipeline
*Date: 2026-02-19 | Status: Approved*

---

## Summary

Add an Event Pipeline to Counting House — a calendar-first tool for managing SafelyYou's event lifecycle from confirmation through debrief. Extends the existing checklist system rather than creating parallel tables.

## Key Decisions

1. **Extend existing checklist system** — Add tier flags and category to `checklist_template_items` and `event_checklist_items`. Reuse all existing checklist CRUD routes and UI. No new `task_templates`/`event_tasks` tables.
2. **Custom-built calendar** — Full control over Victorian styling. CSS Grid approach with multi-day event spanning.
3. **@dnd-kit for Kanban drag-and-drop** — Modern, React 19 compatible, lightweight.
4. **New top-level "Pipeline" nav item** — Lives at `/pipeline` with Calendar (default) and Board tabs. Existing `/events` list stays untouched.

---

## Database Changes

### Migration 020: Pipeline columns on events
```sql
ALTER TABLE events
  ADD COLUMN stage TEXT DEFAULT 'confirmed'
    CHECK (stage IN ('confirmed','in_progress','ready','active','debrief','archived')),
  ADD COLUMN tier TEXT
    CHECK (tier IN ('executive','national_t1','national_t2','state_t1','state_t2','customer_partner')),
  ADD COLUMN shipping_handler TEXT DEFAULT 'handler_b'
    CHECK (shipping_handler IN ('handler_a','handler_b'));
```

### Migration 021: Tier flags + category on checklist items
```sql
ALTER TABLE checklist_template_items
  ADD COLUMN category TEXT,
  ADD COLUMN tier_executive BOOLEAN DEFAULT true,
  ADD COLUMN tier_national_t1 BOOLEAN DEFAULT true,
  ADD COLUMN tier_national_t2 BOOLEAN DEFAULT true,
  ADD COLUMN tier_state_t1 BOOLEAN DEFAULT true,
  ADD COLUMN tier_state_t2 BOOLEAN DEFAULT true,
  ADD COLUMN tier_customer BOOLEAN DEFAULT true;

ALTER TABLE event_checklist_items
  ADD COLUMN category TEXT;
```

### Migration 022: Seed 25 pipeline task templates
- One `checklist_templates` row: "Event Pipeline Tasks" (is_default: true)
- 25 `checklist_template_items` with tier flags, days_offset, default_assignee_role, category, phase

Template data from PRD (25 items with tier applicability matrix).

---

## API Endpoints

### New
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/events/calendar?month=YYYY-MM` | Events for calendar view with task_counts |
| GET | `/api/events/board` | Events grouped by stage for Kanban |
| POST | `/api/events/[id]/checklist/generate` | Auto-generate checklist items from pipeline template filtered by tier |

### Extended (no new routes)
| Method | Endpoint | Change |
|--------|----------|--------|
| PUT | `/api/events/[id]` | Accept stage, tier, shipping_handler fields |
| GET | `/api/events/[id]/checklist` | Include category in response |
| POST/PUT | `/api/checklist-templates/[id]/items` | Accept category + tier boolean fields |

### Due date calculation
- Positive `days_offset` → `due_date = date_start - days_offset` (pre-event)
- Negative `days_offset` → `due_date = date_end + abs(days_offset)` (post-event)

---

## UI Components

### Pipeline Page (`/pipeline`)
- Top-level page with view toggle: Calendar | Board
- Month/week toggle (calendar view only)
- Navigation arrows for prev/next month

### Calendar View (custom-built)
- **CalendarGrid** — 7-column CSS grid, one row per week
- **EventBar** — Colored multi-day block spanning start_date to end_date. Color by tier:
  - Executive = red, National T1 = orange, National T2 = yellow
  - State T1 = blue, State T2 = light blue, Customer/Partner = green
- **TaskMarker** — Dot/badge on dates with tasks due (count across all events)
- **EventSidePanel** — Slide-out on event click: name, dates, tier, budget, team, task completion %, link to detail page
- **TaskPopover** — On task marker click: list of tasks due that day
- Multi-day spanning: events render as absolutely-positioned bars. Week-wrapping creates two visual segments.
- Max ~3 visible events per day cell + "+N more" overflow.

### Kanban Board
- **KanbanBoard** — 5 columns (confirmed → in_progress → ready → active → debrief). @dnd-kit droppable zones.
- **KanbanColumn** — Vertical card list, scrollable. Header shows stage name + count.
- **KanbanCard** — Event name, dates, location, tier badge, budget bar (actual vs estimated), task completion mini bar, countdown.
- Drag-and-drop: optimistic update, PUT /api/events/[id] with new stage on drop.
- Cards sorted by date_start within columns.

### Event Detail Extensions
- Tier badge + shipping indicator in header
- Checklist tab enhanced: category filter pills, owner_role filter, "Generate Pipeline Tasks" button
- Budget tracker already exists via expenses — no changes

### Victorian Styling
- Parchment backgrounds, wood-tone borders
- Playfair Display headings, Geist body text
- Gold accents on active tabs
- Tier color badges match calendar palette

---

## File Structure (new files)
```
src/app/(pages)/pipeline/page.tsx          — Pipeline page (calendar default)
src/components/pipeline/CalendarGrid.tsx   — Month/week calendar grid
src/components/pipeline/EventBar.tsx       — Colored multi-day event block
src/components/pipeline/TaskMarker.tsx     — Task due date dot/badge
src/components/pipeline/EventSidePanel.tsx — Slide-out event detail
src/components/pipeline/TaskPopover.tsx    — Task list popover
src/components/pipeline/KanbanBoard.tsx    — Kanban container
src/components/pipeline/KanbanColumn.tsx   — Single stage column
src/components/pipeline/KanbanCard.tsx     — Event card for board
src/components/pipeline/ViewToggle.tsx     — Calendar/Board tab toggle
src/app/api/events/calendar/route.ts       — Calendar data endpoint
src/app/api/events/board/route.ts          — Board data endpoint
src/app/api/events/[id]/checklist/generate/route.ts — Task generation
supabase/migrations/020_event_pipeline.sql
supabase/migrations/021_checklist_tier_flags.sql
supabase/migrations/022_seed_pipeline_templates.sql
```

---

## Out of Scope (V1)
- Timeline/Gantt view
- Auto-tier derivation in the app (Scrooge handles via API)
- Backfilling tiers on existing events (Scrooge handles)
- Salesforce/Monday.com integration
- Attendee list management
