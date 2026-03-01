/**
 * POST /api/integrations/slack/commands
 *
 * Receives slash commands from Slack (/ghostly).
 * Public route — verified via Slack signing secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySlackNextRequest } from '@/lib/integrations/slack/verification';
import { handleSlackCommand } from '@/lib/integrations/slack/commands';

export async function POST(request: NextRequest) {
  const { verified, body } = await verifySlackNextRequest(request);

  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Slack sends commands as form-urlencoded
  const params = new URLSearchParams(body);
  const command = {
    command: params.get('command') || '',
    text: params.get('text') || '',
    user_id: params.get('user_id') || '',
    user_name: params.get('user_name') || '',
    channel_id: params.get('channel_id') || '',
    team_id: params.get('team_id') || '',
    response_url: params.get('response_url') || '',
    trigger_id: params.get('trigger_id') || '',
  };

  try {
    const response = await handleSlackCommand(command);
    return NextResponse.json(response);
  } catch (err) {
    console.error('Slash command error:', err);
    return NextResponse.json({
      response_type: 'ephemeral' as const,
      text: 'Something went wrong processing your command. Please try again.',
    });
  }
}
