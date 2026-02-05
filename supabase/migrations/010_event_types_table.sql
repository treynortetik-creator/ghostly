-- Migration: Create event_types table and migrate from enum
-- This replaces the hardcoded event_type enum with a configurable table

-- 0. Ensure set_updated_at() function exists (idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Create the event_types table
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

-- 2. Create unique index for name per fiscal year (only for non-archived)
CREATE UNIQUE INDEX event_types_name_fiscal_year_idx
  ON event_types(LOWER(name), fiscal_year_id)
  WHERE is_archived = FALSE;

-- 3. Create index for fiscal year lookups
CREATE INDEX event_types_fiscal_year_idx ON event_types(fiscal_year_id);

-- 4. Add updated_at trigger for event_types
CREATE TRIGGER trg_event_types_updated_at
  BEFORE UPDATE ON event_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Add event_type_id column to events table
ALTER TABLE events ADD COLUMN event_type_id UUID REFERENCES event_types(id) ON DELETE SET NULL;

-- 6. Insert default event types for each existing fiscal year
INSERT INTO event_types (name, description, fiscal_year_id, budget_amount, display_order)
SELECT
  type_data.name,
  type_data.description,
  fy.id,
  0,
  type_data.display_order
FROM fiscal_years fy
CROSS JOIN (
  VALUES
    ('Executive', 'C-suite conferences and leadership events', 1),
    ('National', 'Industry-wide conferences and associations', 2),
    ('State', 'State-level associations and regional events', 3),
    ('Regional', 'Multi-state regional gatherings', 4),
    ('Customer', 'Customer appreciation and engagement events', 5)
) AS type_data(name, description, display_order);

-- 7. Migrate existing events to use the new event_type_id
UPDATE events e
SET event_type_id = et.id
FROM event_types et
WHERE LOWER(e.event_type::text) = LOWER(et.name)
  AND e.fiscal_year_id = et.fiscal_year_id;

-- 8. Handle events with NULL fiscal_year_id (assign to 2026 fiscal year types)
UPDATE events e
SET event_type_id = et.id
FROM event_types et
JOIN fiscal_years fy ON et.fiscal_year_id = fy.id
WHERE e.event_type_id IS NULL
  AND LOWER(e.event_type::text) = LOWER(et.name)
  AND fy.year = 2026;

-- 9. Drop the old event_type column and enum
ALTER TABLE events DROP COLUMN event_type;
DROP TYPE IF EXISTS event_type;
