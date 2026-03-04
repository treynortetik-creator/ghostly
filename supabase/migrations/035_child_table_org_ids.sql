-- 035: Add organization_id to 13 child tables for defense-in-depth tenant isolation.
-- Backfill from parent tables, then enforce NOT NULL + FK + index.
-- Applied via Supabase MCP on 2026-03-03.

-- 1. event_notes (parent: events)
ALTER TABLE event_notes ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE event_notes n SET organization_id = e.organization_id FROM events e WHERE e.id = n.event_id AND n.organization_id IS NULL;
UPDATE event_notes SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE event_notes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE event_notes ADD CONSTRAINT fk_event_notes_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_event_notes_org ON event_notes(organization_id);

-- 2. event_shipments (parent: events)
ALTER TABLE event_shipments ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE event_shipments s SET organization_id = e.organization_id FROM events e WHERE e.id = s.event_id AND s.organization_id IS NULL;
UPDATE event_shipments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE event_shipments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE event_shipments ADD CONSTRAINT fk_event_shipments_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_event_shipments_org ON event_shipments(organization_id);

-- 3. event_travel_logistics (parent: events)
ALTER TABLE event_travel_logistics ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE event_travel_logistics t SET organization_id = e.organization_id FROM events e WHERE e.id = t.event_id AND t.organization_id IS NULL;
UPDATE event_travel_logistics SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE event_travel_logistics ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE event_travel_logistics ADD CONSTRAINT fk_event_travel_logistics_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_event_travel_logistics_org ON event_travel_logistics(organization_id);

-- 4. event_checklist_items (parent: events)
ALTER TABLE event_checklist_items ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE event_checklist_items ci SET organization_id = e.organization_id FROM events e WHERE e.id = ci.event_id AND ci.organization_id IS NULL;
UPDATE event_checklist_items SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE event_checklist_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE event_checklist_items ADD CONSTRAINT fk_event_checklist_items_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_event_checklist_items_org ON event_checklist_items(organization_id);

-- 5. event_team_assignments (parent: events)
ALTER TABLE event_team_assignments ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE event_team_assignments a SET organization_id = e.organization_id FROM events e WHERE e.id = a.event_id AND a.organization_id IS NULL;
UPDATE event_team_assignments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE event_team_assignments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE event_team_assignments ADD CONSTRAINT fk_event_team_assignments_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_event_team_assignments_org ON event_team_assignments(organization_id);

-- 6. event_contacts (parent: events)
ALTER TABLE event_contacts ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE event_contacts ec SET organization_id = e.organization_id FROM events e WHERE e.id = ec.event_id AND ec.organization_id IS NULL;
UPDATE event_contacts SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE event_contacts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE event_contacts ADD CONSTRAINT fk_event_contacts_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_event_contacts_org ON event_contacts(organization_id);

-- 7. event_reminders (parent: events)
ALTER TABLE event_reminders ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE event_reminders r SET organization_id = e.organization_id FROM events e WHERE e.id = r.event_id AND r.organization_id IS NULL;
UPDATE event_reminders SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE event_reminders ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE event_reminders ADD CONSTRAINT fk_event_reminders_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_org ON event_reminders(organization_id);

-- 8. cadence_milestones (parent: cadence_templates)
ALTER TABLE cadence_milestones ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE cadence_milestones m SET organization_id = t.organization_id FROM cadence_templates t WHERE t.id = m.template_id AND m.organization_id IS NULL;
UPDATE cadence_milestones SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE cadence_milestones ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE cadence_milestones ADD CONSTRAINT fk_cadence_milestones_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_cadence_milestones_org ON cadence_milestones(organization_id);

-- 9. checklist_template_items (parent: checklist_templates)
ALTER TABLE checklist_template_items ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE checklist_template_items ci SET organization_id = t.organization_id FROM checklist_templates t WHERE t.id = ci.template_id AND ci.organization_id IS NULL;
UPDATE checklist_template_items SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE checklist_template_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE checklist_template_items ADD CONSTRAINT fk_checklist_template_items_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_checklist_template_items_org ON checklist_template_items(organization_id);

-- 10. chat_messages (parent: chat_sessions)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE chat_messages m SET organization_id = s.organization_id FROM chat_sessions s WHERE s.id = m.session_id AND m.organization_id IS NULL;
UPDATE chat_messages SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE chat_messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org ON chat_messages(organization_id);

-- 11. template_sections (parent: document_templates)
ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE template_sections s SET organization_id = t.organization_id FROM document_templates t WHERE t.id = s.template_id AND s.organization_id IS NULL;
UPDATE template_sections SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE template_sections ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE template_sections ADD CONSTRAINT fk_template_sections_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_template_sections_org ON template_sections(organization_id);

-- 12. webhook_deliveries (parent: webhooks)
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE webhook_deliveries d SET organization_id = w.organization_id FROM webhooks w WHERE w.id = d.webhook_id AND d.organization_id IS NULL;
UPDATE webhook_deliveries SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE webhook_deliveries ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE webhook_deliveries ADD CONSTRAINT fk_webhook_deliveries_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON webhook_deliveries(organization_id);

-- 13. reminder_log (operational)
ALTER TABLE reminder_log ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE reminder_log rl SET organization_id = e.organization_id FROM events e WHERE e.id = rl.entity_id AND rl.organization_id IS NULL;
UPDATE reminder_log SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
ALTER TABLE reminder_log ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE reminder_log ADD CONSTRAINT fk_reminder_log_org FOREIGN KEY (organization_id) REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_reminder_log_org ON reminder_log(organization_id);
