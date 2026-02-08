-- ==============================================
-- Migration 015: Event Cadence Templates & Reminders
-- ==============================================
-- Adds cadence templates (milestone-based reminder schedules)
-- tied to event types, and event_reminders generated from them.

-- 1. cadence_templates — reusable reminder schedules per event type
CREATE TABLE cadence_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type_id UUID REFERENCES event_types(id),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. cadence_milestones — individual reminder offsets within a template
CREATE TABLE cadence_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES cadence_templates(id) ON DELETE CASCADE,
  offset_days INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  notify_channel TEXT DEFAULT 'both' CHECK (notify_channel IN ('scrooge', 'in_app', 'both')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. event_reminders — concrete reminder instances for a specific event
CREATE TABLE event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES cadence_milestones(id),
  reminder_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed', 'snoozed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cadence_templates_event_type ON cadence_templates(event_type_id);
CREATE INDEX idx_cadence_milestones_template ON cadence_milestones(template_id);
CREATE INDEX idx_event_reminders_event ON event_reminders(event_id);
CREATE INDEX idx_event_reminders_date_status ON event_reminders(reminder_date, status);

-- updated_at trigger for cadence_templates
CREATE TRIGGER set_cadence_templates_updated_at
  BEFORE UPDATE ON cadence_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
