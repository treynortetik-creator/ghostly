/**
 * POST /api/integrations/slack/digest
 *
 * Triggers digest generation. Intended to be called by a cron job.
 * Accepts { type: 'daily' | 'weekly' }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDigests } from '@/lib/integrations/slack/digests';

export async function POST(request: NextRequest) {
  // Simple API key check for cron security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const digestType = body.type as 'daily' | 'weekly';

    if (!digestType || !['daily', 'weekly'].includes(digestType)) {
      return NextResponse.json({ error: 'type must be daily or weekly' }, { status: 400 });
    }

    const sent = await processDigests(digestType);

    return NextResponse.json({ success: true, digests_sent: sent });
  } catch (err) {
    console.error('Digest cron error:', err);
    return NextResponse.json({ error: 'Digest processing failed' }, { status: 500 });
  }
}
