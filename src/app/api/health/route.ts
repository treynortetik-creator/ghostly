/**
 * Ghostly - Health Check API
 *
 * GET /api/health — System health check (public, no auth required)
 *
 * Returns overall status and uptime. Uses in-memory rate limiting
 * (not DB-backed) so the health check works even when the database
 * is unreachable — critical for Railway healthcheck probes.
 */

import { NextRequest, NextResponse } from 'next/server';

const startedAt = Date.now();

// Simple in-memory rate limiter for health endpoint (no DB dependency)
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function checkMemoryRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (!checkMemoryRateLimit(clientIp)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  let dbStatus: 'ok' | 'degraded' = 'ok';

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
    dbStatus = 'degraded';
  }

  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  // Always return 200 so Railway healthcheck passes.
  // The db_status field indicates if the database is reachable.
  return NextResponse.json({
    status: 'healthy',
    db_status: dbStatus,
    timestamp: new Date().toISOString(),
    uptime_seconds: uptimeSeconds,
  });
}
