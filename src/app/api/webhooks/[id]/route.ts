/**
 * Ghostly - Single Webhook API
 *
 * Endpoints:
 * GET    /api/webhooks/:id - Get webhook with recent deliveries
 * PUT    /api/webhooks/:id - Update webhook
 * DELETE /api/webhooks/:id - Delete webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';

const VALID_EVENT_TYPES = [
  'expense.created',
  'expense.updated',
  'expense.deleted',
  'event.created',
  'event.updated',
  'event.deleted',
  'budget.threshold_reached',
  '*',
];

/**
 * SSRF protection: block webhook URLs pointing at internal/private networks.
 */
function isUnsafeWebhookUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return 'url must be a valid URL';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Webhook URL must use http or https';
  }
  const hostname = parsed.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'].includes(hostname)) {
    return 'Webhook URL must not point to localhost';
  }
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0) {
      return 'Webhook URL must not point to a private/reserved IP';
    }
  }
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return 'Webhook URL must not point to cloud metadata services';
  }
  return null;
}

type RouteContext = { params: Promise<{ id: string }> };

// ============================================
// GET /api/webhooks/:id
// ============================================

export const GET = withApiHandler({ permission: 'admin', resource: 'webhooks/[id]' },
  async (_request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const supabase = await createClient();

    const [webhookResult, deliveriesResult] = await Promise.all([
      supabase.from('webhooks').select('*').eq('id', id).single(),
      supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('webhook_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (webhookResult.error) {
      if (webhookResult.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
      }
      throw webhookResult.error;
    }

    return NextResponse.json({
      ...webhookResult.data,
      recent_deliveries: deliveriesResult.data || [],
    });
  }
);

// ============================================
// PUT /api/webhooks/:id
// ============================================

export const PUT = withApiHandler({ permission: 'admin', resource: 'webhooks/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    // Verify webhook exists
    const { data: existing, error: fetchError } = await supabase
      .from('webhooks')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Build update object with only provided fields
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.url !== undefined) {
      if (!body.url?.trim()) {
        return NextResponse.json({ error: 'url cannot be empty' }, { status: 400 });
      }
      const urlError = isUnsafeWebhookUrl(body.url.trim());
      if (urlError) {
        return NextResponse.json({ error: urlError }, { status: 400 });
      }
      update.url = body.url.trim();
    }

    if (body.event_types !== undefined) {
      if (!Array.isArray(body.event_types) || body.event_types.length === 0) {
        return NextResponse.json({ error: 'event_types must be a non-empty array' }, { status: 400 });
      }
      const invalidTypes = body.event_types.filter((t: string) => !VALID_EVENT_TYPES.includes(t));
      if (invalidTypes.length > 0) {
        return NextResponse.json(
          { error: `Invalid event_types: ${invalidTypes.join(', ')}` },
          { status: 400 }
        );
      }
      update.event_types = body.event_types;
    }

    if (body.secret !== undefined) update.secret = body.secret || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;
    if (body.description !== undefined) update.description = body.description?.trim() || null;

    const { data: updated, error: updateError } = await supabase
      .from('webhooks')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Audit log
    await auditMutation(request, {
      entity_type: 'webhook',
      entity_id: id,
      action: 'update',
      changes: null,
      metadata: { updated_fields: Object.keys(update).filter(k => k !== 'updated_at') },
    });

    return NextResponse.json(updated);
  }
);

// ============================================
// DELETE /api/webhooks/:id
// ============================================

export const DELETE = withApiHandler({ permission: 'admin', resource: 'webhooks/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const supabase = await createClient();

    const { error } = await supabase.from('webhooks').delete().eq('id', id);

    if (error) throw error;

    // Audit log
    await auditMutation(request, {
      entity_type: 'webhook',
      entity_id: id,
      action: 'delete',
      changes: null,
    });

    return NextResponse.json({ success: true });
  }
);
