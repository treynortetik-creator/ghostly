-- Ghostly Demo Seed Data
-- Realistic event data for Lynnice Wolf demo (March 2, 2026)
-- Run AFTER schema migrations on a fresh Ghostly Supabase project
-- DO NOT run on production CH database

-- ============================================================
-- 1. FISCAL YEAR
-- ============================================================
INSERT INTO fiscal_years (id, year) VALUES
  ('a1000000-0000-0000-0000-000000000001', 2026)
ON CONFLICT (year) DO NOTHING;

-- ============================================================
-- 2. EVENTS (6 events across different stages/tiers)
-- ============================================================
INSERT INTO events (id, name, event_type, quarter, fiscal_year_id, date_start, date_end, location, budget_amount, stage, tier, expansion_goal, net_new_goal, approach_notes, marketing_notes)
VALUES
  -- Event 1: National conference — Active (live demo centerpiece)
  (
    'e1000000-0000-0000-0000-000000000001',
    'Elevate National Summit 2026',
    'national',
    'Q2',
    'a1000000-0000-0000-0000-000000000001',
    '2026-04-15',
    '2026-04-17',
    'Marriott Marquis, Chicago IL',
    85000.00,
    'in_progress',
    'national_t1',
    12,
    5,
    'Main stage sponsorship + hosted dinner. Top networking event in the space. Targeting C-suite operators.',
    'Custom booth 10x20, two speaking slots, pre-event email blast to 400+ attendees.'
  ),

  -- Event 2: Executive dinner — Ready to ship
  (
    'e1000000-0000-0000-0000-000000000002',
    'CEO Roundtable — San Francisco',
    'executive',
    'Q1',
    'a1000000-0000-0000-0000-000000000001',
    '2026-03-18',
    '2026-03-18',
    'Bix Restaurant, San Francisco CA',
    22000.00,
    'ready',
    'executive',
    3,
    0,
    'Private dinner for 18 CEOs. Intimate format. No booth — table conversation only. Relationship-building focus.',
    'Custom welcome packet, branded bar menu, photographer booked.'
  ),

  -- Event 3: State conference — Confirmed/Early Planning
  (
    'e1000000-0000-0000-0000-000000000003',
    'Southwest Regional Connect 2026',
    'state',
    'Q2',
    'a1000000-0000-0000-0000-000000000001',
    '2026-05-06',
    '2026-05-07',
    'JW Marriott, Phoenix AZ',
    34000.00,
    'confirmed',
    'state_t1',
    8,
    3,
    '6x6 tabletop booth. Strong regional operators in attendance. Aim to book 4+ demos.',
    'Retractable banners, digital handouts, swag: branded notebooks.'
  ),

  -- Event 4: Customer/Partner — Debrief (completed)
  (
    'e1000000-0000-0000-0000-000000000004',
    'Sunrise Senior Partner Summit',
    'customer',
    'Q1',
    'a1000000-0000-0000-0000-000000000001',
    '2026-02-10',
    '2026-02-11',
    'Hyatt Regency, Austin TX',
    18500.00,
    'debrief',
    'customer_partner',
    0,
    0,
    'Annual partner event hosted by Sunrise Senior Living. Presentation slot + cocktail reception.',
    'One pager, case study leave-behind, branded pens.'
  ),

  -- Event 5: National — Confirmed (future)
  (
    'e1000000-0000-0000-0000-000000000005',
    'Healthcare Innovation Forum 2026',
    'national',
    'Q3',
    'a1000000-0000-0000-0000-000000000001',
    '2026-07-21',
    '2026-07-23',
    'Gaylord Opryland, Nashville TN',
    62000.00,
    'confirmed',
    'national_t2',
    10,
    4,
    'Mid-year conference. Strong ROI historically. Dinner reservation at Merchants needed for VIP 10.',
    'Silver sponsorship package. Booth 8x8. Co-branded email to 650 registrants.'
  ),

  -- Event 6: Regional — Active (shipping soon)
  (
    'e1000000-0000-0000-0000-000000000006',
    'Pacific Northwest Leadership Exchange',
    'regional',
    'Q2',
    'a1000000-0000-0000-0000-000000000001',
    '2026-04-02',
    '2026-04-02',
    'The Westin, Seattle WA',
    15000.00,
    'in_progress',
    'state_t2',
    5,
    2,
    'Single-day networking event. Smaller audience, high decision-maker concentration.',
    'Pop-up display, three case studies, product demo iPad.'
  );

-- ============================================================
-- 3. BUDGET CATEGORIES
-- ============================================================
INSERT INTO budget_categories (id, name, fiscal_year_id, budget_amount, description)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Swag & Merchandise', 'a1000000-0000-0000-0000-000000000001', 18000.00, 'Branded swag ordered across all events'),
  ('c1000000-0000-0000-0000-000000000002', 'Digital & Creative', 'a1000000-0000-0000-0000-000000000001', 12000.00, 'Design, video, print collateral'),
  ('c1000000-0000-0000-0000-000000000003', 'Team Travel & Lodging', 'a1000000-0000-0000-0000-000000000001', 35000.00, 'Flights, hotels, ground transport for staff'),
  ('c1000000-0000-0000-0000-000000000004', 'Software & Tools', 'a1000000-0000-0000-0000-000000000001', 8000.00, 'Event management software subscriptions'),
  ('c1000000-0000-0000-0000-000000000005', 'Contingency Reserve', 'a1000000-0000-0000-0000-000000000001', 5000.00, 'Unplanned expenses buffer');

-- ============================================================
-- 4. EXPENSES (realistic spend mix per event)
-- ============================================================

-- Elevate National Summit expenses
INSERT INTO expenses (event_id, amount, expense_date, vendor, memo, source_type)
VALUES
  ('e1000000-0000-0000-0000-000000000001', 42000.00, '2026-01-15', 'Elevate Conference Group', 'Platinum sponsorship package', 'manual'),
  ('e1000000-0000-0000-0000-000000000001', 8400.00,  '2026-02-20', 'ExhibitPro Chicago', 'Custom 10x20 booth build + shipping', 'manual'),
  ('e1000000-0000-0000-0000-000000000001', 3200.00,  '2026-03-01', '4imprint', '500 branded tote bags + pens', 'manual'),
  ('e1000000-0000-0000-0000-000000000001', 5600.00,  '2026-03-05', 'Ruth''s Chris Chicago', 'VIP dinner deposit — 20 guests', 'manual'),
  ('e1000000-0000-0000-0000-000000000001', 2100.00,  '2026-02-28', 'United Airlines', '3x round-trip to Chicago (Apr 15)', 'brex');

-- CEO Roundtable expenses
INSERT INTO expenses (event_id, amount, expense_date, vendor, memo, source_type)
VALUES
  ('e1000000-0000-0000-0000-000000000002', 9500.00,  '2026-02-01', 'Bix Restaurant', 'Private dining room + prix fixe — 18 guests', 'manual'),
  ('e1000000-0000-0000-0000-000000000002', 2400.00,  '2026-02-15', 'Graphic Edge SF', 'Welcome packets + custom menus (printed)', 'manual'),
  ('e1000000-0000-0000-0000-000000000002', 1800.00,  '2026-03-01', 'Marriott Union Square', '2x room nights — team', 'brex'),
  ('e1000000-0000-0000-0000-000000000002', 850.00,   '2026-03-10', 'SF Photography Co', 'Event photographer — 3 hours', 'manual');

-- Southwest Regional expenses
INSERT INTO expenses (event_id, amount, expense_date, vendor, memo, source_type)
VALUES
  ('e1000000-0000-0000-0000-000000000003', 18000.00, '2026-01-20', 'SWRC Organizers', 'Tabletop sponsorship package', 'manual'),
  ('e1000000-0000-0000-0000-000000000003', 1200.00,  '2026-02-10', 'Vistaprint', '4x retractable banners + table runner', 'brex'),
  ('e1000000-0000-0000-0000-000000000003', 2200.00,  '2026-03-01', 'Quality Logo Products', '200x branded notebooks', 'manual');

-- Sunrise Partner Summit expenses (completed event)
INSERT INTO expenses (event_id, amount, expense_date, vendor, memo, source_type)
VALUES
  ('e1000000-0000-0000-0000-000000000004', 10000.00, '2025-12-15', 'Sunrise Senior Living', 'Partner event sponsorship', 'manual'),
  ('e1000000-0000-0000-0000-000000000004', 4200.00,  '2026-01-20', 'Hyatt Regency Austin', '3x room nights — team', 'brex'),
  ('e1000000-0000-0000-0000-000000000004', 1900.00,  '2026-02-05', 'AlphaGraphics Austin', 'One pagers + case studies (300 qty)', 'manual'),
  ('e1000000-0000-0000-0000-000000000004', 890.00,   '2026-02-12', 'Delta Air Lines', '2x round-trip Austin', 'brex');

-- Healthcare Innovation Forum expenses (future — partial)
INSERT INTO expenses (event_id, amount, expense_date, vendor, memo, source_type)
VALUES
  ('e1000000-0000-0000-0000-000000000005', 32000.00, '2026-02-01', 'Healthcare Innovation Forum', 'Silver sponsorship deposit (50%)', 'manual');

-- Pacific NW Leadership expenses
INSERT INTO expenses (event_id, amount, expense_date, vendor, memo, source_type)
VALUES
  ('e1000000-0000-0000-0000-000000000006', 8500.00,  '2026-02-15', 'PNWLE Organizers', 'Tabletop + networking reception', 'manual'),
  ('e1000000-0000-0000-0000-000000000006', 1200.00,  '2026-03-01', 'Swag.com', '100x branded pens + 50x iPad cases', 'brex');

-- Non-event expenses (categories)
INSERT INTO expenses (category_id, amount, expense_date, vendor, memo, source_type)
VALUES
  ('c1000000-0000-0000-0000-000000000002', 4200.00, '2026-01-10', 'Design Studio Co', 'Q1 brand refresh — all event collateral templates', 'manual'),
  ('c1000000-0000-0000-0000-000000000004', 1800.00, '2026-01-01', 'Ghostly', 'Annual subscription — event management platform', 'manual'),
  ('c1000000-0000-0000-0000-000000000003', 5400.00, '2026-02-01', 'Various Airlines', 'Q1 team travel — advance bookings', 'brex');

-- ============================================================
-- SUMMARY (for demo narrator reference)
-- ============================================================
-- Total budgeted: $236,500 across 6 events + $78,000 non-event categories
-- Total spent: ~$161,740 (68% committed)
-- Active events: Elevate Summit (Apr), CEO Roundtable (Mar), PNW Exchange (Apr)
-- Completed: Sunrise Partner Summit (Feb) — in debrief
-- Future: Southwest Regional (May), Healthcare Forum (Jul)
--
-- Good demo flow:
--   1. list_events → show active pipeline
--   2. get_event_summary('Elevate National Summit 2026') → full budget breakdown
--   3. add_budget_line → show live editing
--   4. create_event → show how easy it is to spin up new events
--   5. get_event_summary('Sunrise Partner Summit') → completed event ROI review
