-- Reminder configuration and logging
CREATE TABLE reminder_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_type TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  days_before INTEGER DEFAULT 7,
  channel TEXT DEFAULT 'slack',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel TEXT NOT NULL DEFAULT 'slack'
);

CREATE INDEX idx_reminder_log_dedup ON reminder_log(reminder_type, entity_id, (sent_at::date));

-- Default reminder configs
INSERT INTO reminder_config (reminder_type, days_before) VALUES
  ('event_14day', 14),
  ('event_7day', 7),
  ('event_1day', 1);
