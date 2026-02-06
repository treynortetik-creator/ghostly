/**
 * Audit Logger - Tracks all mutations in The Counting House
 *
 * Non-blocking: audit failures never break the main request.
 * Logs to the audit_log table via Supabase.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import type { Json } from '@/types/database';

export type AuditEntityType = 'expense' | 'event' | 'category' | 'team_member';
export type AuditAction = 'create' | 'update' | 'delete';
export type AuditActorType = 'user' | 'agent';

export interface AuditParams {
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
  actor: string;
  actor_type: AuditActorType;
  metadata?: Record<string, unknown> | null;
}

/**
 * Insert an audit log entry. Fire-and-forget — never throws.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('audit_log').insert({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      action: params.action,
      changes: (params.changes ?? null) as Json,
      actor: params.actor,
      actor_type: params.actor_type,
      metadata: (params.metadata ?? null) as Json,
    });
    if (error) {
      console.error('Audit log write failed:', error);
    }
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

/**
 * Compute a diff of changed fields between old and new objects.
 * Returns null if nothing changed.
 */
export function computeChanges(
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
  fields: string[]
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of fields) {
    const oldVal = oldRecord[field];
    const newVal = newRecord[field];
    if (oldVal !== newVal) {
      changes[field] = { old: oldVal, new: newVal };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Extract actor identity from a request.
 * Middleware sets x-auth-type and x-auth-agent-name headers.
 * Falls back to session username for cookie auth.
 */
export async function getActor(request: NextRequest): Promise<{
  actor: string;
  actor_type: AuditActorType;
}> {
  const authType = request.headers.get('x-auth-type');

  if (authType === 'api_key') {
    const agentName = request.headers.get('x-auth-agent-name') || 'unknown_agent';
    return { actor: agentName, actor_type: 'agent' };
  }

  // Cookie auth — resolve username from session
  const session = await getSession();
  return { actor: session?.username || 'unknown', actor_type: 'user' };
}
