-- 021_checklist_tier_flags.sql
-- Add tier applicability flags and category to checklist template items
-- Add category to event checklist items

ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tier_executive BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_national_t1 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_national_t2 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_state_t1 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_state_t2 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_customer BOOLEAN DEFAULT true;

ALTER TABLE event_checklist_items
  ADD COLUMN IF NOT EXISTS category TEXT;
