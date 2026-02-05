# Configurable Event Type Budgets

**Date:** 2026-02-05
**Status:** Approved

## Summary

Replace hardcoded event type enum with database-driven configurable event types. Users can create, edit, archive event types and set budget amounts per fiscal year via the Settings page.

## Decisions

| Decision | Choice |
|----------|--------|
| UI Location | Settings page |
| Budget scope | Per fiscal year |
| Fields | Name, budget amount, description (essential only) |
| Deletion | Archive (soft delete, preserves history) |
| Migration | Replace enum with foreign key |

## Database Schema

### New `event_types` table

```sql
CREATE TABLE event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  budget_amount DECIMAL(12,2) DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX event_types_name_fiscal_year_idx
  ON event_types(LOWER(name), fiscal_year_id)
  WHERE is_archived = FALSE;
```

### Changes to `events` table

```sql
ALTER TABLE events ADD COLUMN event_type_id UUID REFERENCES event_types(id);
-- After migration, drop old column:
ALTER TABLE events DROP COLUMN event_type;
```

## API Endpoints

### New `/api/event-types` route

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/event-types` | List event types (filtered by fiscal year) |
| POST | `/api/event-types` | Create new event type |
| GET | `/api/event-types/[id]` | Get single event type |
| PUT | `/api/event-types/[id]` | Update event type |
| DELETE | `/api/event-types/[id]` | Archive event type |

**Query parameters:**
- `fiscal_year_id` - Filter by fiscal year (required)
- `include_archived` - Include archived types (default: false)

**Response shape:**
```typescript
interface EventType {
  id: string;
  name: string;
  description: string | null;
  fiscal_year_id: string;
  budget_amount: number;
  is_archived: boolean;
  display_order: number;
  actual_spent?: number;
  event_count?: number;
}
```

### Modified endpoints

- `GET/POST /api/events` - Use `event_type_id` foreign key
- `GET /api/dashboard/summary` - Query event_types table for budgets

## Settings Page UI

Add "Event Type Budgets" section below Fiscal Year selector:

- List of event types with name, budget, description
- Click row or menu to edit
- [+ Add Type] button to create
- Menu includes "Archive" option
- Drag handles for reordering (updates `display_order`)
- Responds to fiscal year selector

## Migration Strategy

1. Create `event_types` table
2. Insert 5 default types for current fiscal year:
   - Executive ($0) - "C-suite conferences and leadership events"
   - National ($0) - "Industry-wide conferences and associations"
   - State ($0) - "State-level associations and regional events"
   - Regional ($0) - "Multi-state regional gatherings"
   - Customer ($0) - "Customer appreciation and engagement events"
3. Add `event_type_id` column to `events`
4. Populate by matching old enum values to new rows
5. Drop `event_type` enum column
6. Drop PostgreSQL ENUM type

## Files to Modify

| File | Change |
|------|--------|
| `src/types/database.ts` | Replace union type with interface |
| `src/app/settings/page.tsx` | Add Event Types section |
| `src/components/events/EventForm.tsx` | Fetch types from API |
| `src/components/events/EventFilters.tsx` | Fetch types from API |
| `src/components/events/EventCard.tsx` | Display from joined data |
| `src/components/dashboard/EventTypeSummary.tsx` | Use data from API |
| `src/app/api/events/route.ts` | Join event_types, validate |
| `src/app/api/events/[id]/route.ts` | Join event_types |
| `src/app/api/dashboard/summary/route.ts` | Query budgets from table |
| `src/app/api/dashboard/roi/route.ts` | Join event_types |
| `src/app/api/export/*.ts` | Include event type name |
| `src/app/api/import/*.ts` | Match by name |
| `supabase/seed.sql` | Update for new table |

## New Files

- `src/app/api/event-types/route.ts` - List/create endpoints
- `src/app/api/event-types/[id]/route.ts` - Get/update/archive endpoints
- `src/components/settings/EventTypesSection.tsx` - Settings UI component
- `src/components/settings/EventTypeForm.tsx` - Create/edit form
- `supabase/migrations/XXX_event_types_table.sql` - Migration
