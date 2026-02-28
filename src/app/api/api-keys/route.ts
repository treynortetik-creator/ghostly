/**
 * Ghostly - API Keys Management
 *
 * Endpoints:
 * GET  /api/api-keys - List all API keys (redacted)
 * POST /api/api-keys - Create a new API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashApiKey, generateApiKey } from '@/lib/auth';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

// ============================================
// GET /api/api-keys — List API keys
// ============================================

export const GET = withApiHandler({ permission: 'admin', resource: 'api-keys' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, agent_name, label, permissions, is_active, last_used_at, expires_at, created_at, revoked_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ api_keys: data });
  }
);

// ============================================
// POST /api/api-keys — Create a new API key
// ============================================

export const POST = withApiHandler({ permission: 'admin', resource: 'api-keys' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    if (!body.agent_name?.trim()) {
      return NextResponse.json(
        { error: 'agent_name is required' },
        { status: 400 }
      );
    }

    const agentName = body.agent_name.trim().toLowerCase();
    const label = body.label?.trim() || null;
    const permissions = body.permissions || ['read', 'write'];
    const environment = body.environment || 'live';
    const expiresAt = body.expires_at || null;

    // Validate permissions
    const validPermissions = ['read', 'write', 'admin', 'webhooks'];
    for (const perm of permissions) {
      if (!validPermissions.includes(perm)) {
        return NextResponse.json(
          { error: `Invalid permission: ${perm}. Valid: ${validPermissions.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Generate the raw key and hash
    const rawKey = generateApiKey(agentName, environment);
    const keyHash = hashApiKey(rawKey);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        organization_id: orgId,
        key_hash: keyHash,
        agent_name: agentName,
        label,
        permissions,
        expires_at: expiresAt,
      })
      .select('id, agent_name, label, permissions, is_active, expires_at, created_at')
      .single();

    if (error) throw error;

    // Audit log
    await auditMutation(request, {
      entity_type: 'api_key',
      entity_id: data.id,
      action: 'create',
      changes: null,
      metadata: { agent_name: agentName, permissions },
    });

    // Return the raw key ONCE — it cannot be retrieved again
    return NextResponse.json({
      api_key: {
        ...data,
        key: rawKey,
      },
      warning: 'Store this key securely. It will not be shown again.',
    }, { status: 201 });
  }
);
