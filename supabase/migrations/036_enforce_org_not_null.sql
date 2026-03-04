-- 036: Tighten legacy nullable organization_id columns to NOT NULL.
-- All existing rows already have the default org from migration 025.
-- Applied via Supabase MCP on 2026-03-03.

UPDATE api_keys SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE app_settings SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE audit_log SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE budget_categories SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE cadence_templates SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE checklist_templates SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE documents SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE event_types SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE events SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE expenses SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE reminder_config SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE team_members SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE webhooks SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

ALTER TABLE api_keys ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE audit_log ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE budget_categories ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE cadence_templates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE checklist_templates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE event_types ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE events ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE reminder_config ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE team_members ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE webhooks ALTER COLUMN organization_id SET NOT NULL;
