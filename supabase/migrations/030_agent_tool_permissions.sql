-- Add per-tool permission configuration for the AI agent.
ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS tool_permissions jsonb NOT NULL DEFAULT '{}';
