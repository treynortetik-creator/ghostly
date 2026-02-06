/**
 * The Counting House - Webhooks API
 *
 * Endpoints:
 * GET  /api/webhooks - List all webhooks (admin only)
 * POST /api/webhooks - Create a new webhook (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';

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

// ============================================
// GET /api/webhooks
// ============================================

export async function GET(request: NextRequest) {
  const denied = requirePermission(request, 'admin');
  if (denied) return denied;

  try {
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
  } catch (error) {
    console.error('Webhooks list error:', error);
    logError('Failed to list webhooks', { error: error as Error, source: 'api/webhooks', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });
  }
}

// ============================================
// POST /api/webhooks
// ============================================

export async function POST(request: NextRequest) {
  const denied = requirePermission(request, 'admin');
  if (denied) return denied;

  try {
    const body = await request.json();

    // Validate URL
    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'url must be a valid URL' }, { status: 400 });
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

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error('Webhook create error:', error);
    logError('Failed to create webhook', { error: error as Error, source: 'api/webhooks', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}
