/**
 * The Counting House - Single Webhook API
 *
 * Endpoints:
 * GET    /api/webhooks/:id - Get webhook with recent deliveries
 * PUT    /api/webhooks/:id - Update webhook
 * DELETE /api/webhooks/:id - Delete webhook
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

type RouteContext = { params: Promise<{ id: string }> };

// ============================================
// GET /api/webhooks/:id
// ============================================

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'admin');
  if (denied) return denied;

  try {
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
  } catch (error) {
    console.error('Webhook get error:', error);
    logError('Failed to get webhook', { error: error as Error, source: 'api/webhooks/[id]', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to get webhook' }, { status: 500 });
  }
}

// ============================================
// PUT /api/webhooks/:id
// ============================================

export async function PUT(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'admin');
  if (denied) return denied;

  try {
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
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json({ error: 'url must be a valid URL' }, { status: 400 });
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Webhook update error:', error);
    logError('Failed to update webhook', { error: error as Error, source: 'api/webhooks/[id]', context: { method: 'PUT' } });
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

// ============================================
// DELETE /api/webhooks/:id
// ============================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'admin');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { error } = await supabase.from('webhooks').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook delete error:', error);
    logError('Failed to delete webhook', { error: error as Error, source: 'api/webhooks/[id]', context: { method: 'DELETE' } });
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
