-- Agent runtime, observability, memory, background tasks, and learning support

-- 1) Agent settings extensions (persona/model/guardrails)
ALTER TABLE agent_settings
  ADD COLUMN IF NOT EXISTS system_prompt_template TEXT,
  ADD COLUMN IF NOT EXISTS autonomy_mode TEXT NOT NULL DEFAULT 'safe',
  ADD COLUMN IF NOT EXISTS default_model TEXT,
  ADD COLUMN IF NOT EXISTS model_routing JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_settings_autonomy_mode_check'
  ) THEN
    ALTER TABLE agent_settings
      ADD CONSTRAINT agent_settings_autonomy_mode_check
      CHECK (autonomy_mode IN ('safe', 'full'));
  END IF;
END $$;

-- 2) Agent run logs (observability)
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  model TEXT,
  prompt TEXT,
  response TEXT,
  error TEXT,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  tool_rounds INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_org_started ON agent_runs(organization_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_org_status ON agent_runs(organization_id, status);

-- 3) Background task queue (single-worker path)
CREATE TABLE IF NOT EXISTS agent_background_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  result JSONB,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_background_tasks_status_check'
  ) THEN
    ALTER TABLE agent_background_tasks
      ADD CONSTRAINT agent_background_tasks_status_check
      CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_bg_tasks_org_status_run_after
  ON agent_background_tasks(organization_id, status, run_after);

DROP TRIGGER IF EXISTS trg_agent_background_tasks_updated_at ON agent_background_tasks;
CREATE TRIGGER trg_agent_background_tasks_updated_at
  BEFORE UPDATE ON agent_background_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4) Semantic memory (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_org_created
  ON agent_memories(organization_id, created_at DESC);

-- ivfflat requires ANALYZE after enough rows; still safe to create now
CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding
  ON agent_memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_agent_memories(
  p_organization_id UUID,
  p_query_embedding VECTOR(1536),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id TEXT,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  similarity DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    m.id,
    m.source_type,
    m.source_id,
    m.content,
    m.metadata,
    m.created_at,
    m.expires_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM agent_memories m
  WHERE m.organization_id = p_organization_id
    AND m.embedding IS NOT NULL
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;

-- 5) Learning loop store (user corrections/preferences)
CREATE TABLE IF NOT EXISTS agent_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  topic TEXT,
  correction TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_learnings_org_created
  ON agent_learnings(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_learnings_embedding
  ON agent_learnings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_agent_learnings(
  p_organization_id UUID,
  p_query_embedding VECTOR(1536),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  topic TEXT,
  correction TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  similarity DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    l.id,
    l.topic,
    l.correction,
    l.metadata,
    l.created_at,
    1 - (l.embedding <=> p_query_embedding) AS similarity
  FROM agent_learnings l
  WHERE l.organization_id = p_organization_id
    AND l.embedding IS NOT NULL
  ORDER BY l.embedding <=> p_query_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;
