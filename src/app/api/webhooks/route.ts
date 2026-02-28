/**
 * Ghostly - Webhooks API
 *
 * Endpoints:
 * GET  /api/webhooks - List all webhooks (admin only)
 * POST /api/webhooks - Create a new webhook (admin only)
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

  // Only allow http(s)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Webhook URL must use http or https';
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    return 'Webhook URL must not point to localhost';
  }

  // Block private/reserved IPv4 ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 10 ||                          // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||          // 192.168.0.0/16
      (a === 169 && b === 254) ||          // link-local 169.254.0.0/16
      a === 0 ||                           // 0.0.0.0/8
      a === 127                            // 127.0.0.0/8 loopback
    ) {
      return 'Webhook URL must not point to a private/reserved IP';
    }
  }

  // Block IPv6 private/reserved ranges
  // Strip brackets for IPv6 addresses (URLs use [::1] form)
  const bareHost = hostname.replace(/^\[|\]$/g, '');
  if (isPrivateIPv6(bareHost)) {
    return 'Webhook URL must not point to a private/reserved IP';
  }

  // Block metadata service IPs (cloud SSRF)
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return 'Webhook URL must not point to cloud metadata services';
  }

  return null;
}

/**
 * Check if an IPv6 address is in a private/reserved range.
 * Handles:
 * - ::1 (loopback)
 * - fc00::/7 (unique local addresses - fc00:: and fd00::)
 * - fe80::/10 (link-local)
 * - ::ffff:127.0.0.1 (IPv4-mapped loopback)
 * - ::ffff:10.x.x.x, ::ffff:172.16-31.x.x, ::ffff:192.168.x.x (IPv4-mapped private)
 * - :: (unspecified address)
 */
function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();

  // Loopback
  if (lower === '::1') return true;

  // Unspecified address
  if (lower === '::') return true;

  // Unique local (fc00::/7 covers fc00:: through fdff::)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  // Link-local (fe80::/10 covers fe80:: through febf::)
  if (lower.startsWith('fe8') || lower.startsWith('fe9') ||
      lower.startsWith('fea') || lower.startsWith('feb')) return true;

  // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  const v4MappedMatch = lower.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4MappedMatch) {
    const [, a, b] = v4MappedMatch.map(Number);
    if (
      a === 10 ||                          // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||          // 192.168.0.0/16
      (a === 169 && b === 254) ||          // link-local
      a === 127 ||                         // loopback
      a === 0                              // 0.0.0.0/8
    ) {
      return true;
    }
  }

  return false;
}

// ============================================
// GET /api/webhooks
// ============================================

export const GET = withApiHandler({ permission: 'admin', resource: 'webhooks' },
  async () => {
    const supabase = await createClient();

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
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
    const body = await request.json();

    // Validate URL (includes SSRF protection)
    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const urlError = isUnsafeWebhookUrl(body.url.trim());
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

    const supabase = await createClient();

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
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
