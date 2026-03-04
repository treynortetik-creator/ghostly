/**
 * Ghostly - API Key Management (single key)
 *
 * PATCH /api/api-keys/[id] - Revoke an API key (set revoked_at + is_active=false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

export const PATCH = withApiHandler({ permission: 'admin', resource: 'api-keys' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const orgId = getOrgId(request);
    const body = await request.json();

    if (body.action !== 'revoke') {
      return NextResponse.json({ error: 'Only action "revoke" is supported' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('revoked_at', null)
      .select('id, agent_name, label, revoked_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'API key not found or already revoked' }, { status: 404 });
      }
      throw error;
    }

    await auditMutation(request, {
      entity_type: 'api_key',
      entity_id: data.id,
      action: 'delete',
      changes: null,
      metadata: { agent_name: data.agent_name },
    });

    return NextResponse.json({ success: true, api_key: data });
  }
);
