-- 038: Add organization_id to fiscal_years for per-org fiscal year definitions.
-- Applied via Supabase MCP on 2026-03-03.

ALTER TABLE fiscal_years
  ADD COLUMN IF NOT EXISTS organization_id UUID
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES organizations(id);

UPDATE fiscal_years
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE fiscal_years ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_years_org ON fiscal_years(organization_id);

-- Replace global unique on year with per-org unique
ALTER TABLE fiscal_years DROP CONSTRAINT IF EXISTS fiscal_years_year_key;
ALTER TABLE fiscal_years ADD CONSTRAINT fiscal_years_org_year_unique UNIQUE (organization_id, year);

-- RLS
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_service_bypass ON fiscal_years
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY rls_org_isolation ON fiscal_years
  FOR ALL TO authenticated, anon
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
