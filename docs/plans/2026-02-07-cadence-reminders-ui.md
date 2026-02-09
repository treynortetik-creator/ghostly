# Event Cadence Reminders UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build frontend UI components for the Event Cadence Reminders feature, connecting to existing backend API endpoints.

**Architecture:** Client-side rendered pages following existing patterns — `'use client'` with `useState`/`useEffect` fetch-on-mount. Victorian-themed UI using custom Card, Button, StatCard components with Tailwind and the parchment/wood/ink color palette. No auth headers needed (JWT cookies).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Lucide React icons, custom Victorian UI components (Button, Card, StatCard, ProgressBar).

**NOTE:** Task #3 from the original requirements (Event Form date fields) is ALREADY IMPLEMENTED in `src/components/events/EventForm.tsx:267-296`. No work needed.

---

### Task 1: Cadence Template Management Page

**Files:**
- Create: `src/app/settings/cadence/page.tsx`

This page manages cadence templates and their milestones. It's a standalone page at `/settings/cadence` so the settings page stays clean.

**Step 1: Create the cadence template management page**

Build a full page component that:
- Lists all cadence templates via `GET /api/cadence-templates`
- Create new template via `POST /api/cadence-templates` with name, event_type_id, is_default
- Edit template via `PUT /api/cadence-templates/[id]`
- Delete template via `DELETE /api/cadence-templates/[id]`
- For each template: expand to show milestones, add/edit/delete milestones
- Milestones via `GET /api/cadence-templates/[id]` (returns milestones), `POST /api/cadence-templates/[id]/milestones`, `PUT /api/cadence-templates/[id]/milestones/[mid]`, `DELETE /api/cadence-templates/[id]/milestones/[mid]`
- Milestone fields: offset_days (negative=before event, positive=after), title, description, notify_channel (scrooge|in_app|both), display_order
- Show milestones sorted by offset_days ascending (e.g., -56 → -14 → 0 → +7)
- Victorian naming: "The Cadence Registry"

Follow these existing patterns exactly:
- Page structure: `src/app/settings/page.tsx` (loading/error/success states, Card layout)
- Form pattern: `src/components/events/EventForm.tsx` (validation, inputClasses, labelClasses)
- Import AppShell from `@/components/layout`
- Import Button from `@/components/ui/Button`
- Import Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter from `@/components/ui/Card`
- Fetch event types from `GET /api/event-types` for the dropdown (see EventForm.tsx:88-115 for pattern)

Types to use from `src/types/database.ts`:
```typescript
import type { CadenceTemplate, CadenceMilestone, CadenceTemplateWithMilestones, NotifyChannel, EventTypeRecord } from '@/types/database';
```

The offset_days display should format as human-readable:
- `-56` → "56 days before"
- `-1` → "1 day before"
- `0` → "Day of event"
- `7` → "7 days after"

Colors for milestones: use the existing semantic color pattern:
- Before event (negative offset): `text-sepia` (preparatory)
- Day of (0): `text-ink-gold` (key moment)
- After event (positive): `text-ink-green` (follow-up)

Inline editing pattern for milestones: show a list of milestones with edit/delete buttons. Add milestone button at the bottom opens an inline form. Editing a milestone transforms the row into editable fields.

**Step 2: Verify the build compiles**

Run: `npm run build` or `npx next build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/settings/cadence/page.tsx
git commit -m "feat: add cadence template management page"
```

---

### Task 2: Event Detail Page — Reminders Tab

**Files:**
- Create: `src/components/events/EventRemindersTab.tsx`
- Modify: `src/app/events/[id]/page.tsx` (add tab + import)
- Modify: `src/components/events/index.ts` (add export)

Add a "Reminders" tab to the existing event detail page, following the pattern of `EventTeamTab` and `EventChecklistTab`.

**Step 1: Create the EventRemindersTab component**

Build a component `EventRemindersTab` that:
- Props: `{ eventId: string; eventDateStart: string | null }`
- Fetches reminders via `GET /api/events/[eventId]/reminders`
- Shows each reminder with: date, title, description, status badge
- Color-coded status badges:
  - `pending` + past due (reminder_date < today): `bg-ink-red/15 text-ink-red border-ink-red/30` (red)
  - `pending` + upcoming: `bg-ink-gold/15 text-ink-gold border-ink-gold/30` (yellow/gold)
  - `sent`: `bg-ink-green/15 text-ink-green border-ink-green/30` (green)
  - `dismissed`: `bg-wood-medium/15 text-sepia border-wood-medium/30` (gray)
  - `snoozed`: `bg-sepia/15 text-sepia border-sepia/30`
- "Generate Reminders" button calls `POST /api/events/[eventId]/reminders/generate`
  - Disabled if `eventDateStart` is null (show tooltip: "Set event start date first")
  - Confirm dialog before generating (warns it replaces existing reminders)
- "Dismiss" button on each pending reminder calls `PATCH /api/events/[eventId]/reminders/[rid]` with `{ status: 'dismissed' }`
- Show reminders sorted by reminder_date ascending
- Empty state: "No reminders generated yet. Click 'Generate Reminders' to create a reminder schedule from a cadence template."

Types:
```typescript
import type { EventReminder, ReminderStatus } from '@/types/database';
```

Follow the pattern of `EventTeamTab` / `EventChecklistTab` — self-contained component with its own fetch, loading, and error states.

Format dates as: `formatDate` from event detail page pattern (weekday, month long, day, year).

**Step 2: Add the Reminders tab to the event detail page**

In `src/app/events/[id]/page.tsx`:
- Import `EventRemindersTab` from `@/components/events/EventRemindersTab`
- Add `'reminders'` to the `activeTab` type union: `useState<'details' | 'team' | 'checklist' | 'roi' | 'reminders'>('details')`
- Add a new tab button after "Checklist" and before "ROI":
  ```tsx
  <button onClick={() => setActiveTab('reminders')} className={...same pattern as other tabs...}>
    <Bell className="w-4 h-4 inline mr-1.5 -mt-0.5" />
    Reminders
  </button>
  ```
- Add the tab content:
  ```tsx
  {activeTab === 'reminders' && (
    <EventRemindersTab eventId={id} eventDateStart={event.date_start} />
  )}
  ```
- Import `Bell` from lucide-react

**Step 3: Update barrel export**

In `src/components/events/index.ts`, add:
```typescript
export { EventRemindersTab } from './EventRemindersTab';
```

**Step 4: Verify the build compiles**

Run: `npm run build`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/components/events/EventRemindersTab.tsx src/app/events/[id]/page.tsx src/components/events/index.ts
git commit -m "feat: add reminders timeline tab to event detail page"
```

---

### Task 3: Dashboard Upcoming Reminders Widget

**Files:**
- Create: `src/components/dashboard/UpcomingReminders.tsx`
- Modify: `src/app/page.tsx` (add widget)
- Modify: `src/components/dashboard/index.ts` (add export)

**Step 1: Create the UpcomingReminders component**

Build a component that:
- Fetches `GET /api/reminders/upcoming?days=14`
- Shows next 10 reminders with event name, reminder title, and date
- Each item links to the event detail page: `/events/[event_id]`
- Shows reminder date formatted nicely
- Color-code by urgency: overdue = red, today = gold, upcoming = default sepia
- Empty state: "No upcoming reminders in the next 14 days."
- Loading skeleton matching existing dashboard pattern

Types:
```typescript
import type { EventReminderWithEvent } from '@/types/database';
```

The response shape from `/api/reminders/upcoming`:
```typescript
interface UpcomingRemindersResponse {
  reminders: EventReminderWithEvent[];
  meta: { total: number; date_range: { from: string; to: string; days: number } };
}
```

Component structure — follow the existing dashboard Card pattern (see `src/app/page.tsx:169-186` for Budget Categories card as reference):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Upcoming Reminders</CardTitle>
    <CardDescription>Next 14 days</CardDescription>
  </CardHeader>
  <CardContent>
    {/* reminder items */}
  </CardContent>
</Card>
```

Each reminder item:
```tsx
<Link href={`/events/${reminder.event_id}`}>
  <div className="flex items-center justify-between p-3 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors">
    <div>
      <p className="font-medium text-ink-black">{reminder.title}</p>
      <p className="text-sm text-sepia">{reminder.event_name}</p>
    </div>
    <div className="text-right">
      <p className="text-sm font-medium tabular-nums">{formattedDate}</p>
      <p className="text-xs text-sepia">{daysUntilLabel}</p>
    </div>
  </div>
</Link>
```

**Step 2: Add the widget to the dashboard**

In `src/app/page.tsx`, add the UpcomingReminders component after the Event Type / Quarter grid and before Budget Categories:
```tsx
import { BudgetOverviewCard, EventTypeSummary, QuarterSummary, UpcomingReminders } from '@/components/dashboard';
```
Insert between lines 166 and 168 (after the grid, before Budget Categories):
```tsx
{/* Upcoming Reminders */}
<UpcomingReminders />
```

**Step 3: Update barrel export**

In `src/components/dashboard/index.ts`, add:
```typescript
export { UpcomingReminders } from './UpcomingReminders';
```

**Step 4: Verify the build compiles**

Run: `npm run build`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/components/dashboard/UpcomingReminders.tsx src/app/page.tsx src/components/dashboard/index.ts
git commit -m "feat: add upcoming reminders widget to dashboard"
```

---

### Task 4: Navigation Link to Cadence Templates

**Files:**
- Modify: `src/app/settings/page.tsx` (add link card)

**Step 1: Add a navigation card to the settings page**

In `src/app/settings/page.tsx`, add a link card to the cadence template management page. Insert it after the Event Types section and before the Budget Overview card (around line 305).

Add a card similar to the "About These Settings" card pattern (lines 452-472):
```tsx
<Card>
  <CardContent className="py-6">
    <div className="flex items-start gap-4">
      <div className="p-2 bg-ink-gold/10 rounded-lg">
        <Bell className="w-6 h-6 text-ink-gold" />
      </div>
      <div className="flex-1">
        <h3 className="font-serif font-medium text-wood-dark mb-1">
          Cadence Templates
        </h3>
        <p className="text-sm text-sepia leading-relaxed mb-3">
          Configure reminder schedules for different event types. Templates define when reminders
          are sent relative to an event's start date.
        </p>
        <Link href="/settings/cadence">
          <Button variant="secondary" size="sm">
            Manage Cadence Templates →
          </Button>
        </Link>
      </div>
    </div>
  </CardContent>
</Card>
```

Import `Bell` from lucide-react (add to existing import line).

**Step 2: Verify the build compiles**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add cadence templates link to settings page"
```

---

### Task 5: Build Verification & Final Commit

**Step 1: Run the full build**

Run: `npm run build`
Expected: All pages compile successfully, no TypeScript errors.

**Step 2: Verify all new routes are accessible**

Check these routes exist:
- `/settings/cadence` — cadence template management page
- `/events/[id]` — now has Reminders tab
- `/` — dashboard now has upcoming reminders widget
- `/settings` — now has link to cadence templates

**Step 3: Final commit and push**

```bash
git add -A
git commit -m "feat: complete cadence reminders UI - templates, event reminders tab, dashboard widget"
git push
```
