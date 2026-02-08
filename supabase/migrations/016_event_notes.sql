-- ==============================================
-- Migration 016: Event Notes
-- ==============================================
-- Adds event_notes table for conference overlap alerts
-- and general note-taking by users and the Scrooge AI agent.

CREATE TABLE event_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('competitor_alert', 'general', 'logistics', 'budget')),
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_event_notes_event ON event_notes(event_id);
CREATE INDEX idx_event_notes_type ON event_notes(note_type);
CREATE INDEX idx_event_notes_pinned ON event_notes(pinned);
CREATE INDEX idx_event_notes_created ON event_notes(created_at);

-- updated_at trigger
CREATE TRIGGER set_event_notes_updated_at
  BEFORE UPDATE ON event_notes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE event_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_bypass_event_notes"
  ON event_notes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
