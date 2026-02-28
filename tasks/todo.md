# Sprint 6: Feature Enhancements

## Plan

### Task 1: Full-Text Search (API + UI)
- [x] Create `src/app/api/search/route.ts` — ILIKE search across events + expenses, scoped by org
- [x] Create `src/components/search/SearchCommand.tsx` — Cmd+K palette with debounced search, dropdown results, navigation
- [x] Integrate SearchCommand into AppShell (both desktop sidebar bottom + mobile header)

### Task 2: Bulk Event Operations
- [x] Create `src/app/api/events/bulk/route.ts` — POST handler for `update_stage` and `delete` actions
- [x] Add `selectable` prop to EventCard with checkbox
- [x] Add bulk selection + action bar to EventList
- [x] Wire up to events page

### Task 3: Event Template Cloning
- [x] Create `src/app/api/events/[id]/clone/route.ts` — POST handler that copies event + team + checklist (reset)
- [x] Add Clone button + dialog to event detail page

### Task 4: Configurable Checklist Phases
- [x] Update GET/PUT `/api/settings` to handle `checklist_phases` in org settings JSONB
- [x] Add "Checklist Phases" config section to settings page
- [x] Update EventChecklistTab to use dynamic phases from settings

### Task 5: Configurable Note Types
- [x] Update GET/PUT `/api/settings` to handle `note_types` in org settings JSONB
- [x] Add "Note Types" config section to settings page
- [x] Update EventNotesTab to use dynamic note types from settings

### Task 6: Saved Filter Presets
- [x] Update GET/PUT `/api/settings` to handle `saved_filters` in org settings JSONB
- [x] Create SavedFilters UI component (save + load dropdown)
- [x] Integrate into events page and expenses page

## Review

### Summary of Changes

All 6 tasks completed. TypeScript compiles clean (`tsc --noEmit` exit code 0).

**Files Created (7):**
- `src/app/api/search/route.ts` — ILIKE search API across events + expenses
- `src/components/search/SearchCommand.tsx` — Cmd+K search palette with keyboard navigation
- `src/app/api/events/bulk/route.ts` — Bulk update_stage and delete operations
- `src/app/api/events/[id]/clone/route.ts` — Clone event with team + checklist
- `src/components/settings/ConfigurableListSection.tsx` — Reusable add/remove/reorder list config
- `src/components/filters/SavedFilters.tsx` — Save/load/delete filter presets from org settings

**Files Modified (12):**
- `src/components/layout/AppShell.tsx` — Integrated SearchCommand in desktop + mobile sidebars
- `src/components/events/EventCard.tsx` — Added selectable/selected/onSelectionChange props
- `src/components/events/EventList.tsx` — Bulk selection, action bar, SavedFilters integration
- `src/app/events/page.tsx` — Enabled selectable + onBulkActionComplete
- `src/app/events/[id]/page.tsx` — Clone button + dialog
- `src/app/api/settings/route.ts` — ORG_CONFIG_KEYS support (checklist_phases, note_types, saved_filters)
- `src/components/settings/index.ts` — Exported ConfigurableListSection
- `src/app/settings/page.tsx` — Checklist Phases + Note Types config sections
- `src/components/events/EventChecklistTab.tsx` — Dynamic phases from settings
- `src/components/checklist/ChecklistSection.tsx` — Added phaseLabel prop
- `src/components/events/EventNotesTab.tsx` — Dynamic note types from settings
- `src/components/expenses/ExpenseList.tsx` — SavedFilters integration

### Notes
- All API routes use `getOrgId(request)` for multi-tenancy
- All mutations use `auditMutation` for fire-and-forget audit logging
- Configurable settings stored in `app_settings` table with `(organization_id, key)` unique constraint
- Pre-existing type errors in `src/app/api/agent/` files are unrelated to Sprint 6
