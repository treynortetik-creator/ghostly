-- Migration: Create api_keys table for API key authentication
-- Supports the Scrooge agent and future API consumers

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,            -- SHA-256 hash (never store plaintext)
  agent_name TEXT NOT NULL,                 -- 'scrooge', etc.
  label TEXT,                               -- 'production', 'staging'
  permissions TEXT[] DEFAULT '{read,write}', -- scope array
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ                    -- soft revoke
);

-- Fast lookup by hash (only active, non-revoked keys)
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL AND is_active = TRUE;
CREATE INDEX idx_api_keys_agent ON api_keys(agent_name);

-- Auto-update updated_at
CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
