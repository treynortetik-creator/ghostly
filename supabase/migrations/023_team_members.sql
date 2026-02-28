-- 023_team_members.sql
-- Team members and event-team assignment tables

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  default_role TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS event_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  event_role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, team_member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_team_assignments_event ON event_team_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_team_assignments_member ON event_team_assignments(team_member_id);

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON team_members;
CREATE TRIGGER trg_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_event_team_assignments_updated_at ON event_team_assignments;
CREATE TRIGGER trg_event_team_assignments_updated_at BEFORE UPDATE ON event_team_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
