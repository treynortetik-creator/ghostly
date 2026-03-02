-- ==============================================
-- Migration 031: Event Travel & Logistics
-- ==============================================
-- Adds structured travel/logistics tracking per event and team member.

CREATE TABLE event_travel_logistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  traveler_name TEXT NOT NULL,
  traveler_email TEXT,
  traveler_role TEXT,

  -- Hotel details
  hotel_name TEXT,
  hotel_address TEXT,
  hotel_check_in DATE,
  hotel_check_out DATE,
  hotel_confirmation_number TEXT,

  -- Flight details
  flight_airline TEXT,
  flight_number TEXT,
  flight_departure_airport TEXT,
  flight_arrival_airport TEXT,
  flight_departure_at TIMESTAMPTZ,
  flight_arrival_at TIMESTAMPTZ,
  flight_confirmation_number TEXT,

  -- Ground transport details
  ground_transport_mode TEXT
    CHECK (ground_transport_mode IN ('rental_car', 'shuttle', 'rideshare', 'taxi', 'public_transit', 'other')),
  ground_transport_details TEXT,

  -- Travel budgets (separate from event expenses)
  lodging_budget DECIMAL(10,2) DEFAULT 0 CHECK (lodging_budget >= 0),
  airfare_budget DECIMAL(10,2) DEFAULT 0 CHECK (airfare_budget >= 0),
  ground_transport_budget DECIMAL(10,2) DEFAULT 0 CHECK (ground_transport_budget >= 0),
  meals_budget DECIMAL(10,2) DEFAULT 0 CHECK (meals_budget >= 0),
  misc_travel_budget DECIMAL(10,2) DEFAULT 0 CHECK (misc_travel_budget >= 0),

  notes TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_event_travel_logistics_event ON event_travel_logistics(event_id);
CREATE INDEX idx_event_travel_logistics_member ON event_travel_logistics(team_member_id);
CREATE INDEX idx_event_travel_logistics_deleted ON event_travel_logistics(deleted_at);

ALTER TABLE event_travel_logistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_bypass_event_travel_logistics"
  ON event_travel_logistics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_event_travel_logistics_updated_at
  BEFORE UPDATE ON event_travel_logistics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
