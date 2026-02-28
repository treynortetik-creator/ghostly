-- 025_multi_tenancy.sql
-- Multi-tenancy infrastructure: organizations, org membership, org scoping on all data tables
-- Also fixes: shipping_handler constraint, notify_channel constraint, missing triggers

-- ============================================
-- 1. Organization tables
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_tier TEXT DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  legacy_username TEXT,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_user
  ON organization_members(organization_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_legacy
  ON organization_members(organization_id, legacy_username) WHERE legacy_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_email ON organization_members(email) WHERE email IS NOT NULL;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================
-- 2. Seed default organization
-- ============================================

INSERT INTO organizations (id, name, slug, plan_tier)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default', 'enterprise')
ON CONFLICT (id) DO NOTHING;

-- Seed default org member (legacy admin user)
INSERT INTO organization_members (organization_id, legacy_username, role, accepted_at)
SELECT '00000000-0000-0000-0000-000000000001', 'admin', 'owner', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM organization_members
  WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND legacy_username = 'admin'
);

-- ============================================
-- 3. Add organization_id to all data tables
--    Using DEFAULT so existing rows auto-populate
-- ============================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE budget_categories
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE checklist_templates
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE cadence_templates
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE reminder_config
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES organizations(id);

-- ============================================
-- 4. Indexes on organization_id for fast tenant filtering
-- ============================================

CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_event_types_org ON event_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_org ON budget_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_members_org ON team_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_org ON checklist_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_cadence_templates_org ON cadence_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_reminder_config_org ON reminder_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_org ON app_settings(organization_id);

-- ============================================
-- 5. Fix hardcoded constraints (customer blockers)
-- ============================================

-- Remove hardcoded shipping handler names ('handler_a', 'handler_b')
-- Make it free text so each org can set their own handlers
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_shipping_handler_check;

-- Fix notify_channel: rename 'scrooge' to 'agent' in existing data + constraint
UPDATE cadence_milestones SET notify_channel = 'agent' WHERE notify_channel = 'scrooge';
ALTER TABLE cadence_milestones DROP CONSTRAINT IF EXISTS cadence_milestones_notify_channel_check;
ALTER TABLE cadence_milestones ADD CONSTRAINT cadence_milestones_notify_channel_check
  CHECK (notify_channel IN ('agent', 'in_app', 'both'));

-- ============================================
-- 6. Missing updated_at triggers (from audit)
-- ============================================

DROP TRIGGER IF EXISTS trg_checklist_templates_updated_at ON checklist_templates;
CREATE TRIGGER trg_checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_event_checklist_items_updated_at ON event_checklist_items;
CREATE TRIGGER trg_event_checklist_items_updated_at
  BEFORE UPDATE ON event_checklist_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
