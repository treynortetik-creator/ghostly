/**
 * Ghostly - Webhooks API
 *
 * Endpoints:
 * GET  /api/webhooks - List all webhooks (admin only)
 * POST /api/webhooks - Create a new webhook (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import { VALID_WEBHOOK_EVENT_TYPES } from '@/lib/validation';
import { getUnsafeWebhookUrlReason } from '@/lib/webhooks/url-validation';

const VALID_EVENT_TYPES: readonly string[] = VALID_WEBHOOK_EVENT_TYPES;

// ============================================
// GET /api/webhooks
// ============================================

export const GET = withApiHandler({ permission: 'admin', resource: 'webhooks' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      webhooks: webhooks || [],
      meta: { total: webhooks?.length || 0 },
    });
  }
);

// ============================================
// POST /api/webhooks
// ============================================

export const POST = withApiHandler({ permission: 'admin', resource: 'webhooks' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    // Validate URL (includes SSRF protection)
    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const urlError = getUnsafeWebhookUrlReason(body.url.trim());
    if (urlError) {
      return NextResponse.json({ error: urlError }, { status: 400 });
    }

    // Validate event_types
    if (!Array.isArray(body.event_types) || body.event_types.length === 0) {
      return NextResponse.json({ error: 'event_types must be a non-empty array' }, { status: 400 });
    }

    const invalidTypes = body.event_types.filter((t: string) => !VALID_EVENT_TYPES.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        { error: `Invalid event_types: ${invalidTypes.join(', ')}. Valid types: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        organization_id: orgId,
        url: body.url.trim(),
        event_types: body.event_types,
        secret: body.secret || null,
        is_active: body.is_active !== false,
        description: body.description?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await auditMutation(request, {
      entity_type: 'webhook',
      entity_id: webhook.id,
      action: 'create',
      changes: null,
      metadata: { url: webhook.url, event_types: webhook.event_types },
    });

    return NextResponse.json(webhook, { status: 201 });
  }
);
