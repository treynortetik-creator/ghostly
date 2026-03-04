/**
 * Webhook Delivery System for Ghostly
 *
 * Queues and delivers webhook events to registered endpoints.
 * Non-blocking: failures are logged but never break the caller.
 */

import { createClient } from '@/lib/supabase/server';
import { createHmac } from 'crypto';
import type { Json } from '@/types/database';

interface WebhookPayload {
  event_type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Queue a webhook delivery for all matching webhooks.
 * Non-blocking - failures are logged but don't break the caller.
 */
export async function queueWebhookEvent(eventType: string, data: Record<string, unknown>, organizationId: string): Promise<void> {
  try {
    const supabase = await createClient();

    // Find all active webhooks that subscribe to this event type, scoped to the org
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('id, url, secret, event_types')
      .eq('is_active', true)
      .eq('organization_id', organizationId);

    if (!webhooks || webhooks.length === 0) return;

    const matching = webhooks.filter(w => {
      const types = w.event_types as string[];
      return types.includes(eventType) || types.includes('*');
    });

    if (matching.length === 0) return;

    const payload: WebhookPayload = {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      data,
    };

    // Insert delivery records and get IDs back
    const deliveries = matching.map(w => ({
      webhook_id: w.id,
      event_type: eventType,
      payload: payload as unknown as Json,
      status: 'pending',
    }));

    const { data: inserted } = await supabase
      .from('webhook_deliveries')
      .insert(deliveries)
      .select('id, webhook_id');

    if (!inserted) return;

    // Fire-and-forget: attempt immediate delivery using delivery IDs
    for (const delivery of inserted) {
      const webhook = matching.find(w => w.id === delivery.webhook_id);
      if (webhook) {
        deliverWebhook(delivery.id, webhook.url, webhook.secret, payload).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Webhook queue error:', err);
  }
}

async function deliverWebhook(
  deliveryId: string,
  url: string,
  secret: string | null,
  payload: WebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Ghostly-Webhooks/1.0',
  };

  if (secret) {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  const supabase = await createClient();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });

    await supabase.from('webhook_deliveries')
      .update({
        status: res.ok ? 'delivered' : 'failed',
        response_status: res.status,
        response_body: (await res.text()).substring(0, 1000),
        attempts: 1,
      })
      .eq('id', deliveryId);
  } catch (err) {
    await supabase.from('webhook_deliveries')
      .update({
        status: 'failed',
        response_body: err instanceof Error ? err.message : 'Delivery failed',
        attempts: 1,
      })
      .eq('id', deliveryId);
  }
}
