-- 021_checklist_tier_flags.sql
-- Create checklist tables (missing from prior migrations) and add tier flags

-- Enum for checklist phases
DO $$ BEGIN
  CREATE TYPE checklist_phase AS ENUM ('pre_event', 'day_of', 'post_event');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Checklist templates
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Checklist template items (includes tier flags and category inline)
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  phase checklist_phase NOT NULL DEFAULT 'pre_event',
  default_assignee_role TEXT,
  days_offset INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  tier_executive BOOLEAN DEFAULT true,
  tier_national_t1 BOOLEAN DEFAULT true,
  tier_national_t2 BOOLEAN DEFAULT true,
  tier_state_t1 BOOLEAN DEFAULT true,
  tier_state_t2 BOOLEAN DEFAULT true,
  tier_customer BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event checklist items (instances for a specific event)
CREATE TABLE IF NOT EXISTS event_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES checklist_template_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  phase checklist_phase NOT NULL DEFAULT 'pre_event',
  assignee_id UUID,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template ON checklist_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_event_checklist_items_event ON event_checklist_items(event_id);
