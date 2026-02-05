/**
 * The Counting House - API Keys Management
 *
 * Endpoints:
 * GET  /api/api-keys - List all API keys (redacted)
 * POST /api/api-keys - Create a new API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashApiKey, generateApiKey } from '@/lib/auth';

// ============================================
// GET /api/api-keys — List API keys
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Only cookie-authed admin users can manage API keys
    const authType = request.headers.get('x-auth-type');
    if (authType === 'api_key') {
      const permissions = JSON.parse(request.headers.get('x-auth-permissions') || '[]');
      if (!permissions.includes('admin')) {
        return NextResponse.json(
          { error: 'API key does not have admin permission', code: 'AUTH_INSUFFICIENT_PERMISSIONS' },
          { status: 403 }
        );
      }
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, agent_name, label, permissions, is_active, last_used_at, expires_at, created_at, revoked_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ api_keys: data });
  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/api-keys — Create a new API key
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Only cookie-authed admin users can create API keys
    const authType = request.headers.get('x-auth-type');
    if (authType === 'api_key') {
      const permissions = JSON.parse(request.headers.get('x-auth-permissions') || '[]');
      if (!permissions.includes('admin')) {
        return NextResponse.json(
          { error: 'API key does not have admin permission', code: 'AUTH_INSUFFICIENT_PERMISSIONS' },
          { status: 403 }
        );
      }
    }

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
        key_hash: keyHash,
        agent_name: agentName,
        label,
        permissions,
        expires_at: expiresAt,
      })
      .select('id, agent_name, label, permissions, is_active, expires_at, created_at')
      .single();

    if (error) throw error;

    // Return the raw key ONCE — it cannot be retrieved again
    return NextResponse.json({
      api_key: {
        ...data,
        key: rawKey,
      },
      warning: 'Store this key securely. It will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}
