-- Add 'post_event' to the valid note types for event_notes table
ALTER TABLE event_notes DROP CONSTRAINT IF EXISTS event_notes_note_type_check;
ALTER TABLE event_notes ADD CONSTRAINT event_notes_note_type_check 
  CHECK (note_type IN ('competitor_alert', 'general', 'logistics', 'budget', 'post_event'));