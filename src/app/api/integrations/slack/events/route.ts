/**
 * POST /api/integrations/slack/events
 *
 * Receives events from Slack (app_mention, message.im).
 * Public route — verified via Slack signing secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySlackNextRequest } from '@/lib/integrations/slack/verification';
import { handleSlackEvent } from '@/lib/integrations/slack/events';

export async function POST(request: NextRequest) {
  const { verified, body } = await verifySlackNextRequest(request);

  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // Handle Slack URL verification challenge
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Handle event callbacks
  if (payload.type === 'event_callback') {
    const eventType = payload.event?.type;

    if (eventType === 'app_mention' || eventType === 'message') {
      // Process async — respond to Slack within 3 seconds
      handleSlackEvent(payload).catch((err) => {
        console.error('Async Slack event handling failed:', err);
      });
    }
  }

  // Always respond 200 quickly
  return NextResponse.json({ ok: true });
}
