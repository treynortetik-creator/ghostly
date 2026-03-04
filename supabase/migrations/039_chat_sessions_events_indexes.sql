-- Performance indexes for common query patterns

-- chat_sessions.updated_at: used for ordering recent sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at
  ON chat_sessions(updated_at DESC);

-- events.created_at: used for filtering/sorting events by creation date
CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON events(created_at DESC)
  WHERE deleted_at IS NULL;
