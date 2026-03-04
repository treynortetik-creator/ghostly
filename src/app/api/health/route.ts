/**
 * Ghostly - Health Check API
 *
 * GET /api/health — System health check (public, no auth required)
 *
 * Returns only overall status and uptime. No error details or infra info
 * are exposed to prevent information leakage to unauthenticated callers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { getClientIp } from '@/lib/utils';

const startedAt = Date.now();

// Rate limit settings for the health endpoint
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;  // max 10 per minute per IP

export async function GET(request: NextRequest) {
  // Rate limit check (database-backed)
  const clientIp = getClientIp(request);
  const rateCheck = await checkRateLimit(
    `health:${clientIp}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );

  if (!rateCheck.allowed) {
    const retryAfterSeconds = Math.ceil((rateCheck.resetAt.getTime() - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(retryAfterSeconds, 1)),
        },
      }
    );
  }

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
