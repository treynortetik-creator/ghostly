# Multi-Tenancy Hardening for SaaS Launch

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close all multi-tenancy gaps so Ghostly is production-ready as a multi-user SaaS where each customer gets isolated data and their own MCP connection.

**Architecture:** The app already has solid org-based isolation at the API layer (108/108 routes filter by org_id). This plan hardens the database layer (add org_id to 13 child tables, enforce NOT NULL on 13 legacy tables, add RLS policies) and builds the user onboarding flow (signup -> org creation -> API key -> MCP config).

**Tech Stack:** Supabase (PostgreSQL), Next.js App Router, MCP SDK, jose JWT

---

## Current State (Audit Results)

**What's already working:**
- 29/38 tables have `organization_id`
- ALL 108 protected API routes filter by org correctly
- Nested routes validate parent ownership before returning child data
- API keys map to organizations, middleware resolves org context
- MCP server forwards per-user API keys via AsyncLocalStorage

**What needs fixing:**
- 13 child tables lack `organization_id` (rely on FK joins for isolation)
- 13 legacy tables have nullable `organization_id` (should be NOT NULL)
- Only 2 tables have real RLS policies
- No user onboarding flow exists (signup -> org -> API key -> MCP config)
- No org switcher in the UI for multi-org users

---

## Task 1: Database Migration — Add organization_id to Child Tables

**Files:**
- Create: `supabase/migrations/035_child_table_org_ids.sql`

**Context:** These child tables currently inherit org isolation through FK joins to parent tables. Adding `organization_id` directly provides defense-in-depth and enables direct RLS policies.

**Tables to modify (13):**

| Child Table | Parent Table | FK Column |
|---|---|---|
| event_notes | events | event_id |
| event_shipments | events | event_id |
| event_travel_logistics | events | event_id |
| event_checklist_items | events | event_id |
| event_team_assignments | events | event_id |
| event_contacts | events | event_id |
| event_reminders | events | event_id |
| cadence_milestones | cadence_templates | template_id |
| checklist_template_items | checklist_templates | template_id |
| chat_messages | chat_sessions | session_id |
| template_sections | document_templates | template_id |
| webhook_deliveries | webhooks | webhook_id |
| reminder_log | (operational) | entity_id |

**Step 1: Write the migration SQL**

```sql
-- 035_child_table_org_ids.sql
-- Add organization_id to child tables for defense-in-depth tenant isolation.
-- Backfill from parent tables, then enforce NOT NULL + FK + index.

BEGIN;

-- Helper: default org for any orphaned rows
DO $$ BEGIN PERFORM '00000000-0000-0000-0000-000000000001'::uuid; END $$;

-- ============================================================
-- 1. event_notes  (parent: events)
-- ============================================================
ALTER TABLE event_notes
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE event_notes n
SET organization_id = e.organization_id
FROM events e WHERE e.id = n.event_id
WHERE n.organization_id IS NULL;

UPDATE event_notes
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE event_notes
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_event_notes_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_event_notes_org ON event_notes(organization_id);

-- ============================================================
-- 2. event_shipments  (parent: events)
-- ============================================================
ALTER TABLE event_shipments
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE event_shipments s
SET organization_id = e.organization_id
FROM events e WHERE e.id = s.event_id
WHERE s.organization_id IS NULL;

UPDATE event_shipments
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE event_shipments
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_event_shipments_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_event_shipments_org ON event_shipments(organization_id);

-- ============================================================
-- 3. event_travel_logistics  (parent: events)
-- ============================================================
ALTER TABLE event_travel_logistics
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE event_travel_logistics t
SET organization_id = e.organization_id
FROM events e WHERE e.id = t.event_id
WHERE t.organization_id IS NULL;

UPDATE event_travel_logistics
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE event_travel_logistics
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_event_travel_logistics_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_event_travel_logistics_org ON event_travel_logistics(organization_id);

-- ============================================================
-- 4. event_checklist_items  (parent: events)
-- ============================================================
ALTER TABLE event_checklist_items
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE event_checklist_items ci
SET organization_id = e.organization_id
FROM events e WHERE e.id = ci.event_id
WHERE ci.organization_id IS NULL;

UPDATE event_checklist_items
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE event_checklist_items
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_event_checklist_items_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_event_checklist_items_org ON event_checklist_items(organization_id);

-- ============================================================
-- 5. event_team_assignments  (parent: events)
-- ============================================================
ALTER TABLE event_team_assignments
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE event_team_assignments a
SET organization_id = e.organization_id
FROM events e WHERE e.id = a.event_id
WHERE a.organization_id IS NULL;

UPDATE event_team_assignments
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE event_team_assignments
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_event_team_assignments_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_event_team_assignments_org ON event_team_assignments(organization_id);

-- ============================================================
-- 6. event_contacts  (parent: events)
-- ============================================================
ALTER TABLE event_contacts
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE event_contacts ec
SET organization_id = e.organization_id
FROM events e WHERE e.id = ec.event_id
WHERE ec.organization_id IS NULL;

UPDATE event_contacts
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE event_contacts
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_event_contacts_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_event_contacts_org ON event_contacts(organization_id);

-- ============================================================
-- 7. event_reminders  (parent: events)
-- ============================================================
ALTER TABLE event_reminders
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE event_reminders r
SET organization_id = e.organization_id
FROM events e WHERE e.id = r.event_id
WHERE r.organization_id IS NULL;

UPDATE event_reminders
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE event_reminders
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_event_reminders_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_event_reminders_org ON event_reminders(organization_id);

-- ============================================================
-- 8. cadence_milestones  (parent: cadence_templates)
-- ============================================================
ALTER TABLE cadence_milestones
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE cadence_milestones m
SET organization_id = t.organization_id
FROM cadence_templates t WHERE t.id = m.template_id
WHERE m.organization_id IS NULL;

UPDATE cadence_milestones
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE cadence_milestones
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_cadence_milestones_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_cadence_milestones_org ON cadence_milestones(organization_id);

-- ============================================================
-- 9. checklist_template_items  (parent: checklist_templates)
-- ============================================================
ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE checklist_template_items ci
SET organization_id = t.organization_id
FROM checklist_templates t WHERE t.id = ci.template_id
WHERE ci.organization_id IS NULL;

UPDATE checklist_template_items
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE checklist_template_items
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_checklist_template_items_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_org ON checklist_template_items(organization_id);

-- ============================================================
-- 10. chat_messages  (parent: chat_sessions)
-- ============================================================
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE chat_messages m
SET organization_id = s.organization_id
FROM chat_sessions s WHERE s.id = m.session_id
WHERE m.organization_id IS NULL;

UPDATE chat_messages
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE chat_messages
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_chat_messages_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_org ON chat_messages(organization_id);

-- ============================================================
-- 11. template_sections  (parent: document_templates)
-- ============================================================
ALTER TABLE template_sections
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE template_sections s
SET organization_id = t.organization_id
FROM document_templates t WHERE t.id = s.template_id
WHERE s.organization_id IS NULL;

UPDATE template_sections
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE template_sections
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_template_sections_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_template_sections_org ON template_sections(organization_id);

-- ============================================================
-- 12. webhook_deliveries  (parent: webhooks)
-- ============================================================
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE webhook_deliveries d
SET organization_id = w.organization_id
FROM webhooks w WHERE w.id = d.webhook_id
WHERE d.organization_id IS NULL;

UPDATE webhook_deliveries
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE webhook_deliveries
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_webhook_deliveries_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON webhook_deliveries(organization_id);

-- ============================================================
-- 13. reminder_log  (operational, backfill via entity join)
-- ============================================================
ALTER TABLE reminder_log
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Best-effort backfill: reminder_log.entity_type is usually 'event'
UPDATE reminder_log rl
SET organization_id = e.organization_id
FROM events e WHERE e.id = rl.entity_id
WHERE rl.organization_id IS NULL;

UPDATE reminder_log
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE reminder_log
  ALTER COLUMN organization_id SET NOT NULL,
  ADD CONSTRAINT fk_reminder_log_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_reminder_log_org ON reminder_log(organization_id);

COMMIT;
```

**Step 2: Apply the migration**

Run via Supabase MCP: `apply_migration` with name `child_table_org_ids`

**Step 3: Verify all child tables now have organization_id**

```sql
SELECT table_name FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'organization_id'
ORDER BY table_name;
```

Expected: 42 tables (29 existing + 13 new)

**Step 4: Commit**

```bash
git add supabase/migrations/035_child_table_org_ids.sql
git commit -m "feat: add organization_id to 13 child tables for tenant isolation"
```

---

## Task 2: Database Migration — Enforce NOT NULL on Legacy Tables

**Files:**
- Create: `supabase/migrations/036_enforce_org_not_null.sql`

**Context:** 13 legacy tables had `organization_id` added as nullable with a default. All existing rows already have the default org. Tighten to NOT NULL.

**Tables:** api_keys, app_settings, audit_log, budget_categories, cadence_templates, checklist_templates, documents, event_types, events, expenses, reminder_config, team_members, webhooks

**Step 1: Write the migration**

```sql
-- 036_enforce_org_not_null.sql
-- Tighten legacy nullable organization_id columns to NOT NULL.
-- All existing rows already have the default org from migration 025.

BEGIN;

-- Backfill any stragglers
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

-- Enforce NOT NULL
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

COMMIT;
```

**Step 2: Apply migration**

**Step 3: Verify**

```sql
SELECT table_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'organization_id'
  AND is_nullable = 'YES';
```

Expected: 0 rows (all organization_id columns are NOT NULL)

**Step 4: Commit**

```bash
git add supabase/migrations/036_enforce_org_not_null.sql
git commit -m "feat: enforce NOT NULL on all organization_id columns"
```

---

## Task 3: Database Migration — RLS Policies for All Org-Scoped Tables

**Files:**
- Create: `supabase/migrations/037_rls_org_isolation.sql`

**Context:** Only 2 tables have real RLS policies. Add org-isolation RLS to ALL tenant-scoped tables as a defense-in-depth safety net. The app uses the service role key (bypasses RLS), but this protects against any direct DB access or future anon-key usage.

**Step 1: Write the migration**

```sql
-- 037_rls_org_isolation.sql
-- Enable RLS and add org-isolation policies on ALL tenant-scoped tables.
-- The app uses service_role (bypasses RLS), so this is defense-in-depth.
-- Policies use current_setting('app.current_org_id') for anon/authenticated roles.

BEGIN;

-- Macro: for each org-scoped table, enable RLS + add org isolation policy + service bypass
-- We use DO blocks to make this idempotent.

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'events', 'event_types', 'expenses', 'budget_categories',
    'team_members', 'documents', 'document_templates', 'template_sections',
    'contacts', 'event_contacts',
    'event_notes', 'event_shipments', 'event_travel_logistics',
    'event_checklist_items', 'event_team_assignments', 'event_reminders',
    'checklist_templates', 'checklist_template_items',
    'cadence_templates', 'cadence_milestones',
    'webhooks', 'webhook_deliveries',
    'api_keys', 'app_settings', 'audit_log',
    'reminder_config', 'reminder_log',
    'chat_sessions', 'chat_messages',
    'agent_settings', 'agent_runs', 'agent_background_tasks',
    'agent_memories', 'agent_learnings', 'agent_trigger_notifications',
    'agent_cron_jobs',
    'integrations', 'integration_digest_config',
    'integration_event_channels', 'integration_notification_routes',
    'notifications'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop existing policies to avoid conflicts
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS rls_org_isolation ON %I', tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS rls_service_bypass ON %I', tbl);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Service role bypass (our app uses this)
    EXECUTE format(
      'CREATE POLICY rls_service_bypass ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl
    );

    -- Org isolation for authenticated/anon roles
    EXECUTE format(
      'CREATE POLICY rls_org_isolation ON %I FOR ALL TO authenticated, anon USING (organization_id = current_setting(''app.current_org_id'', true)::uuid) WITH CHECK (organization_id = current_setting(''app.current_org_id'', true)::uuid)',
      tbl
    );
  END LOOP;
END $$;

COMMIT;
```

**Step 2: Apply migration**

**Step 3: Verify**

```sql
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'rls_%'
ORDER BY tablename;
```

Expected: 82 policies (41 tables x 2 policies each)

**Step 4: Commit**

```bash
git add supabase/migrations/037_rls_org_isolation.sql
git commit -m "feat: add RLS org-isolation policies to all 41 tenant-scoped tables"
```

---

## Task 4: Add fiscal_years Organization Scoping

**Files:**
- Create: `supabase/migrations/038_fiscal_years_org.sql`
- Modify: `src/app/api/fiscal-years/route.ts` — add org filtering

**Context:** fiscal_years is currently global. Each org should have their own fiscal year definitions. Multiple existing tables FK to fiscal_years (events, event_types, budget_categories).

**Step 1: Write the migration**

```sql
-- 038_fiscal_years_org.sql
-- Add organization_id to fiscal_years for per-org fiscal year definitions.

BEGIN;

ALTER TABLE fiscal_years
  ADD COLUMN IF NOT EXISTS organization_id UUID
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES organizations(id);

UPDATE fiscal_years
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

ALTER TABLE fiscal_years ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_years_org ON fiscal_years(organization_id);

-- Add unique constraint per org+year
ALTER TABLE fiscal_years
  DROP CONSTRAINT IF EXISTS fiscal_years_year_key;

ALTER TABLE fiscal_years
  ADD CONSTRAINT fiscal_years_org_year_unique UNIQUE (organization_id, year);

-- RLS
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_service_bypass ON fiscal_years
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY rls_org_isolation ON fiscal_years
  FOR ALL TO authenticated, anon
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

COMMIT;
```

**Step 2: Update fiscal-years API route to filter by org**

Read `src/app/api/fiscal-years/route.ts` first, then add `getOrgId(request)` and `.eq('organization_id', orgId)` to all queries. Follow the same pattern as other routes.

**Step 3: Apply migration and verify**

**Step 4: Commit**

```bash
git add supabase/migrations/038_fiscal_years_org.sql src/app/api/fiscal-years/route.ts
git commit -m "feat: scope fiscal_years to organizations"
```

---

## Task 5: User Onboarding Flow — Org Creation + API Key Generation

**Files:**
- Modify: `src/app/onboarding/page.tsx` — build onboarding UI
- Create: `src/app/api/onboarding/route.ts` — API endpoint for org + key creation
- Modify: `src/app/auth/callback/route.ts` — ensure new users route to onboarding

**Context:** When a new user signs up via Google OAuth, they need an organization created, membership assigned, and optionally an API key for MCP. The callback already redirects to `/onboarding` if no org membership exists.

**Step 1: Read existing onboarding page**

Read `src/app/onboarding/page.tsx` to see what exists.

**Step 2: Create onboarding API endpoint**

```typescript
// src/app/api/onboarding/route.ts
// POST: Create org + membership + optional API key for new user
// Body: { orgName: string, generateApiKey?: boolean }
// Returns: { organization, apiKey? }
```

The endpoint should:
1. Get user from Supabase session (use service role to create server client)
2. Create organization with slugified name
3. Add user as `owner` in `organization_members`
4. Optionally generate API key bound to new org
5. Set the `ghostly-active-org` cookie
6. Return org details + API key (if generated)

**Step 3: Build onboarding UI**

Simple form:
- Organization name input
- "Create Organization" button
- On success, show API key (one-time display) and MCP config instructions
- "Go to Dashboard" button

**Step 4: Verify flow end-to-end**

1. Clear cookies, go to `/login`
2. Click "Continue with Google"
3. Should redirect to `/onboarding` (new user, no org)
4. Enter org name, submit
5. Should create org, show API key, redirect to dashboard

**Step 5: Commit**

```bash
git add src/app/onboarding/page.tsx src/app/api/onboarding/route.ts
git commit -m "feat: add user onboarding flow with org creation and API key generation"
```

---

## Task 6: Settings Page — API Key Management + MCP Config Display

**Files:**
- Modify: `src/app/settings/page.tsx` — add API keys section and MCP config display
- Modify: `src/app/api/api-keys/route.ts` — verify it supports key generation

**Context:** Users need a place to view/manage API keys and see their MCP configuration. The API keys route already exists and filters by org.

**Step 1: Read existing settings page and API keys route**

**Step 2: Add API Keys panel to settings**

Add a section that:
- Lists active API keys (name, label, created date, last used)
- "Generate New Key" button that creates a key and shows it once
- "Revoke" button per key
- MCP configuration block showing the user's config JSON:
  ```json
  {
    "mcpServers": {
      "ghostly": {
        "url": "https://ghostly-mcp-production.up.railway.app/mcp",
        "authorization_token": "<your-api-key>"
      }
    }
  }
  ```

**Step 3: Verify key generation and revocation work**

**Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add API key management and MCP config to settings"
```

---

## Task 7: Org Switcher for Multi-Org Users

**Files:**
- Create: `src/components/OrgSwitcher.tsx` — dropdown component
- Create: `src/app/api/organizations/switch/route.ts` — endpoint to switch active org
- Modify: sidebar/header layout to include the switcher

**Context:** Users can belong to multiple orgs. Need a way to switch between them. The middleware already supports the `ghostly-active-org` cookie.

**Step 1: Create switch API endpoint**

```typescript
// POST /api/organizations/switch
// Body: { organizationId: string }
// Sets ghostly-active-org cookie, returns success
```

Validate user has membership in the target org before switching.

**Step 2: Create OrgSwitcher component**

- Fetch user's orgs from `/api/organizations`
- Show current org name
- Dropdown to switch
- On select, POST to switch endpoint + refresh page

**Step 3: Add to layout**

Read the sidebar/header layout, add the OrgSwitcher in an appropriate location.

**Step 4: Commit**

```bash
git add src/components/OrgSwitcher.tsx src/app/api/organizations/switch/route.ts
git commit -m "feat: add org switcher for multi-org users"
```

---

## Task 8: Build Verification + Final Commit

**Step 1: Run Next.js build**

```bash
cd "/Users/treynor/Documents/APP REPO/ghostly" && npx next build
```

Expected: Build succeeds with no errors.

**Step 2: Verify all migrations applied**

```sql
SELECT table_name, COUNT(*) as col_count
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'organization_id'
GROUP BY table_name
ORDER BY table_name;
```

Expected: 42+ tables with organization_id

**Step 3: Verify RLS policies**

```sql
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
```

Expected: 80+ policies

**Step 4: Run Supabase security advisors**

Use `mcp__supabase__get_advisors` with type "security" to check for any remaining issues.

**Step 5: Final commit if any loose changes**

```bash
git add -A && git commit -m "chore: multi-tenancy hardening complete"
git push origin main
```

---

## Tables Intentionally Left Without organization_id

These are system/infrastructure tables that don't contain tenant data:

| Table | Reason |
|---|---|
| error_logs | System debugging, no sensitive tenant data |
| idempotency_keys | Request dedup infrastructure, expires in 24h |
| rate_limit_entries | IP-based rate limiting, auto-cleaned |
| waitlist | Pre-signup, no org context yet |
| organizations | IS the org table |
| organization_members | Junction table for org membership |

---

## Post-Launch Checklist

- [ ] Each new customer goes through onboarding flow
- [ ] Each customer gets unique API key bound to their org
- [ ] MCP server requires per-user Bearer token (no shared default)
- [ ] Monitor audit_log for cross-org access attempts
- [ ] Add per-org rate limiting (future enhancement)
- [ ] Regular security audits of org_id filtering
