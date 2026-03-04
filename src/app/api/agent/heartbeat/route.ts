/**
 * Agent Worker / Heartbeat Endpoint
 *
 * POST /api/agent/heartbeat
 *
 * Runs due heartbeat jobs, scheduled cron jobs, event trigger checks,
 * and background tasks through one worker path.
 *
 * Protected by CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAgentWorker } from '@/lib/agent/worker';
import { getErrorMessage } from '@/lib/utils';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured; blocking /api/agent/heartbeat');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const summary = await runAgentWorker({
      orgId: body.organization_id ? String(body.organization_id) : undefined,
      runHeartbeat: body.run_heartbeat !== false,
      runCron: body.run_cron !== false,
      runTriggers: body.run_triggers !== false,
      runBackground: body.run_background !== false,
    });

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('Agent worker error:', error);
    return NextResponse.json(
      {
        error: 'Agent worker execution failed',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    endpoint: '/api/agent/heartbeat',
    description: 'POST to execute due heartbeat/cron/trigger/background agent jobs.',
  });
}
