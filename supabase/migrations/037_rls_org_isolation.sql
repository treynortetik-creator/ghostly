-- 037: Enable RLS and add org-isolation policies on ALL tenant-scoped tables.
-- The app uses service_role (bypasses RLS), so this is defense-in-depth.
-- Policies use current_setting('app.current_org_id') for anon/authenticated roles.
-- Applied via Supabase MCP on 2026-03-03.

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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_org_isolation ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_service_bypass ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY rls_service_bypass ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY rls_org_isolation ON %I FOR ALL TO authenticated, anon USING (organization_id = current_setting(''app.current_org_id'', true)::uuid) WITH CHECK (organization_id = current_setting(''app.current_org_id'', true)::uuid)',
      tbl
    );
  END LOOP;
END $$;
