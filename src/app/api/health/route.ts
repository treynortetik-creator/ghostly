/**
 * The Counting House - Health Check API
 *
 * GET /api/health — System health check (public, no auth required)
 */

import { NextResponse } from 'next/server';

const startedAt = Date.now();

export async function GET() {
  const checks: Record<string, { status: string; latency_ms: number; error?: string }> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Database connectivity check
  const dbStart = Date.now();
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase not configured');
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/fiscal_years?select=id&limit=1`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Database responded with ${res.status}`);
    }

    checks.database = {
      status: 'healthy',
      latency_ms: Date.now() - dbStart,
    };
  } catch (err) {
    checks.database = {
      status: 'unhealthy',
      latency_ms: Date.now() - dbStart,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
    overallStatus = 'degraded';
  }

  // OpenRouter connectivity check
  const orStart = Date.now();
  try {
    const orKey = process.env.OPENROUTER_API_KEY;
    if (!orKey) throw new Error('OpenRouter not configured');

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${orKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`OpenRouter responded with ${res.status}`);

    checks.openrouter = { status: 'healthy', latency_ms: Date.now() - orStart };
  } catch (err) {
    checks.openrouter = {
      status: 'unhealthy',
      latency_ms: Date.now() - orStart,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  const body = {
    status: overallStatus,
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
    checks,
    uptime_seconds: uptimeSeconds,
  };

  return NextResponse.json(body, {
    status: overallStatus === 'healthy' ? 200 : 503,
  });
}
