-- Rate limit entries table for database-backed rate limiting
-- Replaces in-memory Map-based rate limiting for multi-instance support

CREATE TABLE IF NOT EXISTS rate_limit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_window ON rate_limit_entries(key, window_start);

-- Auto-cleanup: entries older than 1 hour are stale and safe to delete.
-- A periodic cleanup job (e.g., admin/cleanup or pg_cron) should call:
--   DELETE FROM rate_limit_entries WHERE window_start < NOW() - INTERVAL '1 hour';
