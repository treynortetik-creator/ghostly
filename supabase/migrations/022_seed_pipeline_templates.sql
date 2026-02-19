-- 022_seed_pipeline_templates.sql
-- Seed the default pipeline checklist template with 25 task items

DO $$
DECLARE
  tmpl_id UUID;
BEGIN
  -- Create the pipeline checklist template
  INSERT INTO checklist_templates (name, is_default)
  VALUES ('Event Pipeline Template', true)
  RETURNING id INTO tmpl_id;

  -- Pre-event tasks (sorted by days_offset descending: 56, 42, 28, 21, 14)
  INSERT INTO checklist_template_items
    (template_id, title, days_offset, default_assignee_role, category, phase, sort_order,
     tier_executive, tier_national_t1, tier_national_t2, tier_state_t1, tier_state_t2, tier_customer)
  VALUES
    -- 56 days out
    (tmpl_id, 'Research local events & experiences', 56, 'scrooge', 'planning', 'pre_event'::checklist_phase, 1,
     true, true, true, false, false, false),

    -- 42 days out
    (tmpl_id, 'Confirm event attendees', 42, 'sales_leadership', 'planning', 'pre_event'::checklist_phase, 2,
     true, true, true, true, true, true),
    (tmpl_id, 'Confirm availability & secure hotel', 42, 'marketing', 'logistics', 'pre_event'::checklist_phase, 3,
     true, true, true, true, true, true),
    (tmpl_id, 'Collect event requirements & confirm collateral', 42, 'marketing', 'materials', 'pre_event'::checklist_phase, 4,
     true, true, true, true, true, true),
    (tmpl_id, 'Create event Slack channel', 42, 'marketing', 'comms', 'pre_event'::checklist_phase, 5,
     true, true, true, true, true, true),
    (tmpl_id, 'Source & order swag', 42, 'marketing', 'materials', 'pre_event'::checklist_phase, 6,
     true, true, true, true, true, true),
    (tmpl_id, 'Pre-event planning meeting', 42, 'marketing', 'planning', 'pre_event'::checklist_phase, 7,
     true, true, true, true, true, true),
    (tmpl_id, 'Marketing collateral (new)', 42, 'marketing', 'materials', 'pre_event'::checklist_phase, 8,
     true, true, false, false, false, false),

    -- 28 days out
    (tmpl_id, 'Book flights & transportation', 28, 'sales', 'logistics', 'pre_event'::checklist_phase, 9,
     true, true, true, true, true, true),
    (tmpl_id, 'Create event guide', 28, 'marketing', 'comms', 'pre_event'::checklist_phase, 10,
     true, true, true, true, true, true),
    (tmpl_id, '1:1 email templates', 28, 'marketing', 'comms', 'pre_event'::checklist_phase, 11,
     true, true, false, true, false, false),
    (tmpl_id, 'Marketing email send', 28, 'marketing', 'comms', 'pre_event'::checklist_phase, 12,
     true, true, true, true, false, false),

    -- 21 days out
    (tmpl_id, 'Secure dinner reservations', 21, 'marketing', 'logistics', 'pre_event'::checklist_phase, 13,
     true, true, false, true, false, false),

    -- 14 days out
    (tmpl_id, 'Provide onsite team info packet', 14, 'marketing', 'comms', 'pre_event'::checklist_phase, 14,
     true, true, true, true, true, true),
    (tmpl_id, '2nd planning meeting', 14, 'marketing', 'planning', 'pre_event'::checklist_phase, 15,
     true, true, false, false, false, false),
    (tmpl_id, 'Submit shipment request (Monday.com)', 14, 'scrooge', 'logistics', 'pre_event'::checklist_phase, 16,
     true, true, false, true, false, false),

    -- Post-event tasks (sorted by days_offset descending: -3, -7, -14, -30, -60)
    -- -3 days (3 days after event)
    (tmpl_id, 'Update SF campaign — spoke to + notes', -3, 'sales', 'post_event', 'post_event'::checklist_phase, 17,
     true, true, true, true, true, true),
    (tmpl_id, 'Complete post-event recap questionnaire', -3, 'sales', 'post_event', 'post_event'::checklist_phase, 18,
     true, true, true, true, true, true),
    (tmpl_id, 'Photos/feedback to Slack channel', -3, 'sales', 'post_event', 'post_event'::checklist_phase, 19,
     true, true, true, true, true, true),

    -- -7 days (7 days after event)
    (tmpl_id, 'Post-event email follow-up', -7, 'sales', 'post_event', 'post_event'::checklist_phase, 20,
     true, true, true, true, true, true),
    (tmpl_id, 'Create SF reporting dashboard', -7, 'marketing', 'post_event', 'post_event'::checklist_phase, 21,
     true, true, true, true, true, true),
    (tmpl_id, 'Post-event debrief call', -7, 'marketing', 'post_event', 'post_event'::checklist_phase, 22,
     true, true, false, true, false, false),

    -- -14 days (14 days after event)
    (tmpl_id, 'Create event finance report', -14, 'scrooge', 'post_event', 'post_event'::checklist_phase, 23,
     true, true, false, true, false, false),

    -- -30 days (30 days after event)
    (tmpl_id, 'Document results — 30 day check', -30, 'marketing', 'post_event', 'post_event'::checklist_phase, 24,
     true, true, true, true, true, true),

    -- -60 days (60 days after event)
    (tmpl_id, 'Document results — 60 day check', -60, 'marketing', 'post_event', 'post_event'::checklist_phase, 25,
     true, true, true, true, true, true);
END $$;
