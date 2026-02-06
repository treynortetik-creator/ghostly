/**
 * The Counting House - Webhook Test API
 *
 * POST /api/webhooks/test - Send a test payload to a webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';
import { createHmac } from 'crypto';
import type { Json } from '@/types/database';

export async function POST(request: NextRequest) {
  const denied = requirePermission(request, 'admin');
  if (denied) return denied;

  try {
    const body = await request.json();

    if (!body.webhook_id) {
      return NextResponse.json({ error: 'webhook_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: webhook, error: fetchError } = await supabase
      .from('webhooks')
      .select('id, url, secret')
      .eq('id', body.webhook_id)
      .single();

    if (fetchError || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Build test payload
    const testPayload = {
      event_type: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery from The Counting House.',
        webhook_id: webhook.id,
      },
    };

    const payloadBody = JSON.stringify(testPayload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CountingHouse-Webhooks/1.0',
    };

    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret).update(payloadBody).digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Deliver the test event
    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody = '';
    let deliveryStatus = 'delivered';

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadBody,
        signal: AbortSignal.timeout(10000),
      });

      responseStatus = res.status;
      responseBody = (await res.text()).substring(0, 1000);
      deliveryStatus = res.ok ? 'delivered' : 'failed';
    } catch (err) {
      deliveryStatus = 'failed';
      responseBody = err instanceof Error ? err.message : 'Delivery failed';
    }

    const latencyMs = Date.now() - startTime;

    // Record the test delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhook.id,
      event_type: 'webhook.test',
      payload: testPayload as unknown as Json,
      status: deliveryStatus,
      response_status: responseStatus,
      response_body: responseBody,
      attempts: 1,
    });

    return NextResponse.json({
      success: deliveryStatus === 'delivered',
      status: deliveryStatus,
      response_status: responseStatus,
      response_body: responseBody,
      latency_ms: latencyMs,
    });
  } catch (error) {
    console.error('Webhook test error:', error);
    logError('Failed to test webhook', { error: error as Error, source: 'api/webhooks/test', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to test webhook' }, { status: 500 });
  }
}
