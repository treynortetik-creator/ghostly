# RAG Search for Agent Memories & Sessions

**Date:** 2026-02-28
**Status:** Draft

---

## Overview

Add hybrid search (70% semantic, 30% keyword) to the AI agent so it can find information from past conversations and stored memories. Uses OpenAI `text-embedding-3-small` for vector embeddings and Supabase `pgvector` for similarity search.

---

## Architecture

### Embedding Model

- **Model:** OpenAI `text-embedding-3-small` (1536 dimensions)
- **Cost:** ~$0.02 per 1M tokens — effectively free at our scale
- **Why OpenAI vs OpenRouter:** OpenRouter doesn't proxy embedding models well. Direct OpenAI API is standard for embeddings.
- **New env var:** `OPENAI_API_KEY`

### Database Changes

#### Enable pgvector extension

```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

#### New table: `agent_memories`

Standalone facts the agent learns and stores for long-term recall (vendor preferences, user habits, recurring decisions).

```sql
CREATE TABLE agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Categories: `general`, `preference`, `vendor`, `decision`, `process`

#### New columns on existing tables

```sql
ALTER TABLE chat_messages ADD COLUMN embedding vector(1536);
ALTER TABLE chat_sessions ADD COLUMN summary_embedding vector(1536);
```

#### Indexes

```sql
CREATE INDEX idx_agent_memories_embedding ON agent_memories
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chat_messages_embedding ON chat_messages
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chat_sessions_summary_embedding ON chat_sessions
  USING hnsw (summary_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

HNSW indexes for fast approximate nearest neighbor search. `m=16, ef_construction=64` balances speed vs recall for our scale.

#### Full-text search indexes (for keyword leg)

```sql
CREATE INDEX idx_chat_messages_content_fts ON chat_messages
  USING gin (to_tsvector('english', content));

CREATE INDEX idx_agent_memories_content_fts ON agent_memories
  USING gin (to_tsvector('english', content));
```

---

## Embedding Pipeline

### When embeddings are generated

1. **Chat messages** — After each message is saved (fire-and-forget, same pattern as auto-summarize)
2. **Session summaries** — When compaction generates a summary, embed it
3. **Agent memories** — When the agent creates/updates a memory via tool

### Embedding API endpoint

`POST /api/agent/embed` (internal only)

```
Body: { texts: string[], ids: { table: string, id: string, column: string }[] }
```

- Calls OpenAI embeddings API in batch (up to 2048 inputs per call)
- Updates the corresponding rows with the embedding vectors
- Fire-and-forget from callers

### Embedding helper

```typescript
// src/lib/agent/embeddings.ts
export async function generateEmbeddings(texts: string[]): Promise<number[][]>
export async function embedAndStore(table: string, id: string, column: string, text: string): Promise<void>
```

---

## Search

### Agent tool: `search_memory`

```
Parameters:
  query (string, required) — what to search for
  scope (string, optional) — "all" | "messages" | "memories" | "summaries" (default: "all")
  limit (number, optional) — max results (default: 10, max: 20)
```

### Search flow

1. Embed the query text using OpenAI
2. Run two parallel queries per source table:

**Semantic (70% weight):**
```sql
SELECT id, content, 1 - (embedding <=> $query_embedding) AS similarity
FROM chat_messages
WHERE session_id IN (SELECT id FROM chat_sessions WHERE organization_id = $org_id)
ORDER BY embedding <=> $query_embedding
LIMIT 20;
```

**Keyword (30% weight):**
```sql
SELECT id, content, ts_rank(to_tsvector('english', content), query) AS rank
FROM chat_messages,
     plainto_tsquery('english', $query) query
WHERE session_id IN (SELECT id FROM chat_sessions WHERE organization_id = $org_id)
  AND to_tsvector('english', content) @@ query
ORDER BY rank DESC
LIMIT 20;
```

3. **Reciprocal Rank Fusion (RRF):**
   - For each result, compute: `score = 0.7 * (1 / (k + semantic_rank)) + 0.3 * (1 / (k + keyword_rank))`
   - `k = 60` (standard RRF constant)
   - Merge and deduplicate across tables
   - Return top N results

### Response format

```json
{
  "results": [
    {
      "source": "message",
      "content": "The catering budget for Q2 Summit was set at $15,000...",
      "session_title": "Budget Planning Discussion",
      "created_at": "2026-02-15T...",
      "score": 0.87
    },
    {
      "source": "memory",
      "content": "User prefers vendor XYZ for all AV equipment.",
      "category": "vendor",
      "created_at": "2026-02-20T...",
      "score": 0.74
    }
  ]
}
```

---

## Agent Memory Tools

### `save_memory`

Store a fact for long-term recall. Agent uses this proactively when it learns something worth remembering.

```
Parameters:
  content (string, required) — the fact to remember
  category (string, optional) — general, preference, vendor, decision, process
```

### `search_memory` (described above)

### `list_memories`

Browse stored memories.

```
Parameters:
  category (string, optional) — filter by category
  limit (number, optional) — default 20
```

### `delete_memory`

Remove a memory that's no longer relevant.

```
Parameters:
  memory_id (string, required)
```

---

## System Prompt Update

Add to the agent's system prompt:

```
You have long-term memory. Use the search_memory tool to find relevant context from past conversations and stored facts. Use save_memory to remember important decisions, user preferences, vendor information, and recurring processes. Proactively save useful information — don't wait for the user to ask you to remember something.
```

---

## Implementation Order

1. DB migration: enable pgvector, create agent_memories table, add embedding columns + indexes
2. Embedding helper: `src/lib/agent/embeddings.ts`
3. Embed endpoint: `POST /api/agent/embed`
4. Memory CRUD: save/list/delete endpoints + agent tools
5. Search endpoint: `GET /api/agent/tools/search-memory` with hybrid RRF
6. Background embedding in chat route (fire-and-forget after message save)
7. System prompt update to use memory tools
8. Backfill existing messages (one-time migration script)

---

## Cost & Performance

- **Embedding cost:** ~$0.02/1M tokens. A 500-word message is ~700 tokens. 10,000 messages = $0.14.
- **Search latency:** HNSW index lookup is <10ms for <100K vectors. RRF merge adds negligible overhead.
- **Storage:** 1536-dim vector = ~6KB per row. 10,000 messages = ~60MB. Well within Supabase limits.
- **Backfill:** Existing messages can be embedded in batches of 2048 via OpenAI's batch endpoint.
