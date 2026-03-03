/**
 * Agent Semantic Memory + Learning Helpers
 */

import { createClient } from '@/lib/supabase/server';
import { buildOrIlikeClause, sanitizePostgrestFilterTerm } from '@/lib/postgrest';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const MAX_MEMORY_CONTENT_LENGTH = 8000;

export interface MemoryRecord {
  id: string;
  source_type: string;
  source_id: string | null;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at: string | null;
  similarity?: number;
}

export interface LearningRecord {
  id: string;
  topic: string | null;
  correction: string;
  metadata: Record<string, unknown>;
  created_at: string;
  similarity?: number;
}

async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const content = text.trim();
  if (!content) return null;

  try {
    const response = await fetch(`${OPENROUTER_API_URL}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Ghostly Agent',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: content.slice(0, MAX_MEMORY_CONTENT_LENGTH),
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const vector = data?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) {
      return null;
    }

    return vector as number[];
  } catch {
    return null;
  }
}

function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

export async function rememberAgentMemory(params: {
  orgId: string;
  sourceType: string;
  sourceId?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  ttlDays?: number | null;
}): Promise<void> {
  const content = String(params.content || '').trim().slice(0, MAX_MEMORY_CONTENT_LENGTH);
  if (!content) return;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  const embedding = await embedText(content);
  const expiresAt = params.ttlDays && params.ttlDays > 0
    ? new Date(Date.now() + params.ttlDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  try {
    const payload: Record<string, unknown> = {
      organization_id: params.orgId,
      source_type: params.sourceType,
      source_id: params.sourceId || null,
      content,
      metadata: params.metadata || {},
      expires_at: expiresAt,
    };

    if (embedding && embedding.length > 0) {
      payload.embedding = toPgVectorLiteral(embedding);
    }

    await supabaseAny.from('agent_memories').insert(payload);
  } catch {
    // Non-fatal by design.
  }
}

export async function recallAgentMemories(
  orgId: string,
  query: string,
  limit = 5
): Promise<MemoryRecord[]> {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  // Attempt semantic recall first.
  const queryEmbedding = await embedText(trimmed);
  if (queryEmbedding && queryEmbedding.length > 0) {
    try {
      const { data, error } = await supabaseAny.rpc('match_agent_memories', {
        p_organization_id: orgId,
        p_query_embedding: toPgVectorLiteral(queryEmbedding),
        p_match_count: Math.max(1, Math.min(limit, 20)),
      });

      if (!error && Array.isArray(data)) {
        return data as MemoryRecord[];
      }
    } catch {
      // Fall through to lexical fallback.
    }
  }

  // Fallback: lexical recall (most recent matching snippets)
  try {
    const safe = sanitizePostgrestFilterTerm(trimmed);
    let queryBuilder = supabaseAny
      .from('agent_memories')
      .select('id, source_type, source_id, content, metadata, created_at, expires_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit, 20)));

    if (safe) {
      queryBuilder = queryBuilder.ilike('content', `%${safe}%`);
    }

    const { data } = await queryBuilder;
    const now = Date.now();

    return ((data || []) as MemoryRecord[]).filter((memory) => {
      if (!memory.expires_at) return true;
      const expiry = new Date(memory.expires_at).getTime();
      return Number.isFinite(expiry) && expiry > now;
    });
  } catch {
    return [];
  }
}

export async function rememberLearning(params: {
  orgId: string;
  topic?: string | null;
  correction: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const correction = String(params.correction || '').trim().slice(0, MAX_MEMORY_CONTENT_LENGTH);
  if (!correction) return;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;
  const embedding = await embedText(`${params.topic || ''}\n${correction}`.trim());

  try {
    const payload: Record<string, unknown> = {
      organization_id: params.orgId,
      topic: params.topic || null,
      correction,
      metadata: params.metadata || {},
    };

    if (embedding && embedding.length > 0) {
      payload.embedding = toPgVectorLiteral(embedding);
    }

    await supabaseAny.from('agent_learnings').insert(payload);
  } catch {
    // Non-fatal by design.
  }
}

export async function recallLearnings(
  orgId: string,
  query: string,
  limit = 3
): Promise<LearningRecord[]> {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  const queryEmbedding = await embedText(trimmed);
  if (queryEmbedding && queryEmbedding.length > 0) {
    try {
      const { data, error } = await supabaseAny.rpc('match_agent_learnings', {
        p_organization_id: orgId,
        p_query_embedding: toPgVectorLiteral(queryEmbedding),
        p_match_count: Math.max(1, Math.min(limit, 10)),
      });

      if (!error && Array.isArray(data)) {
        return data as LearningRecord[];
      }
    } catch {
      // fallback
    }
  }

  try {
    const safe = sanitizePostgrestFilterTerm(trimmed);
    let queryBuilder = supabaseAny
      .from('agent_learnings')
      .select('id, topic, correction, metadata, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(limit * 3, 60)));

    if (safe) {
      const clause = buildOrIlikeClause(['correction', 'topic'], safe);
      if (clause) {
        queryBuilder = queryBuilder.or(clause);
      }
    }

    const { data } = await queryBuilder;

    return ((data || []) as LearningRecord[]).slice(0, Math.max(1, Math.min(limit, 10)));
  } catch {
    return [];
  }
}
