-- 034_worker_idempotency_and_rate_limit_rpc.sql
-- Hardening:
-- 1) Atomic trigger dedupe claims for worker notifications
-- 2) Atomic DB-backed rate limit consumption RPC

-- ------------------------------------------------------------
-- Trigger dedupe claims (worker idempotency)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_trigger_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_trigger_notifications_org_key
  ON agent_trigger_notifications(organization_id, trigger_key);

CREATE INDEX IF NOT EXISTS idx_agent_trigger_notifications_created
  ON agent_trigger_notifications(created_at DESC);

-- ------------------------------------------------------------
-- Rate limiter atomic consume RPC
-- ------------------------------------------------------------

-- Deduplicate historical rows so we can enforce unique bucket rows.
WITH grouped AS (
  SELECT
    key,
    window_start,
    SUM(count)::INTEGER AS total_count,
    MIN(id) AS keep_id
  FROM rate_limit_entries
  GROUP BY key, window_start
)
UPDATE rate_limit_entries r
SET count = g.total_count
FROM grouped g
WHERE r.id = g.keep_id;

WITH grouped AS (
  SELECT
    key,
    window_start,
    MIN(id) AS keep_id
  FROM rate_limit_entries
  GROUP BY key, window_start
)
DELETE FROM rate_limit_entries r
USING grouped g
WHERE r.key = g.key
  AND r.window_start = g.window_start
  AND r.id <> g.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_key_window_unique
  ON rate_limit_entries(key, window_start);

CREATE OR REPLACE FUNCTION consume_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_bucket TIMESTAMPTZ := date_trunc('second', v_now);
  v_total INTEGER := 0;
  v_window_seconds INTEGER := GREATEST(COALESCE(p_window_seconds, 1), 1);
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 1), 1);
BEGIN
  -- Keep table bounded per key.
  DELETE FROM rate_limit_entries
  WHERE key = p_key
    AND window_start < (v_now - make_interval(secs => v_window_seconds));

  INSERT INTO rate_limit_entries (key, window_start, count)
  VALUES (p_key, v_bucket, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rate_limit_entries.count + 1;

  SELECT COALESCE(SUM(count), 0)::INTEGER
  INTO v_total
  FROM rate_limit_entries
  WHERE key = p_key
    AND window_start >= (v_now - make_interval(secs => v_window_seconds));

  allowed := (v_total <= v_limit);
  remaining := GREATEST(v_limit - v_total, 0);
  reset_at := v_now + make_interval(secs => v_window_seconds);
  RETURN NEXT;
END;
$$;
