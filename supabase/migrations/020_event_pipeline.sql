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
