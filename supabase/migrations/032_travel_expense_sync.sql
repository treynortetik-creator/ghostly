-- ==============================================
-- Migration 032: Travel Expense Synchronization
-- ==============================================
-- Adds deterministic links between event travel/logistics entries and expenses,
-- plus explicit travel budget bucketing.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS budget_bucket TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS travel_logistics_entry_id UUID REFERENCES event_travel_logistics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS travel_cost_type TEXT;

-- Backfill existing rows to a consistent bucket.
UPDATE expenses
SET budget_bucket = 'category'
WHERE category_id IS NOT NULL;

UPDATE expenses
SET budget_bucket = 'event'
WHERE event_id IS NOT NULL
  AND budget_bucket IS DISTINCT FROM 'event'
  AND budget_bucket IS DISTINCT FROM 'travel';

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_budget_bucket_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_budget_bucket_check
  CHECK (budget_bucket IN ('event', 'travel', 'category'));

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_travel_cost_type_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_travel_cost_type_check
  CHECK (
    travel_cost_type IS NULL
    OR travel_cost_type IN ('lodging', 'airfare', 'ground_transport', 'meals', 'misc')
  );

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_bucket_matches_target_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_bucket_matches_target_check
  CHECK (
    (category_id IS NOT NULL AND event_id IS NULL AND budget_bucket = 'category')
    OR (event_id IS NOT NULL AND category_id IS NULL AND budget_bucket IN ('event', 'travel'))
  );

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_travel_fields_consistency_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_travel_fields_consistency_check
  CHECK (
    budget_bucket = 'travel'
    OR (travel_logistics_entry_id IS NULL AND travel_cost_type IS NULL)
  );

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_travel_cost_type_required_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_travel_cost_type_required_check
  CHECK (budget_bucket <> 'travel' OR travel_cost_type IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_expenses_budget_bucket
  ON expenses(budget_bucket)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_event_bucket
  ON expenses(event_id, budget_bucket)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_travel_entry
  ON expenses(travel_logistics_entry_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_travel_type
  ON expenses(travel_cost_type)
  WHERE deleted_at IS NULL;
