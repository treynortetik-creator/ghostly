/**
 * The Counting House - Health Check API
 *
 * GET /api/health — System health check (public, no auth required)
 *
 * Returns only overall status and uptime. No error details or infra info
 * are exposed to prevent information leakage to unauthenticated callers.
 */

import { NextResponse } from 'next/server';

const startedAt = Date.now();

export async function GET() {
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Database connectivity check
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('not configured');
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/fiscal_years?select=id&limit=1`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error('unhealthy');
    }
  } catch {
    overallStatus = 'degraded';
  }

  // OpenRouter connectivity check
  try {
    const orKey = process.env.OPENROUTER_API_KEY;
    if (!orKey) throw new Error('not configured');

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${orKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error('unhealthy');
  } catch {
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime_seconds: uptimeSeconds,
    },
    { status: overallStatus === 'healthy' ? 200 : 503 },
  );
}
