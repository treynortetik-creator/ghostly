-- Add context tracking fields to chat_sessions
ALTER TABLE chat_sessions
  ADD COLUMN context_tokens_used integer NOT NULL DEFAULT 0,
  ADD COLUMN context_summary text;

-- Index for finding sessions that need compaction
CREATE INDEX idx_chat_sessions_context ON chat_sessions (context_tokens_used)
  WHERE context_tokens_used > 0;
