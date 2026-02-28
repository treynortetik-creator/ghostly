/**
 * Ghostly - Health Check API
 *
 * GET /api/health — System health check (public, no auth required)
 *
 * Returns only overall status and uptime. No error details or infra info
 * are exposed to prevent information leakage to unauthenticated callers.
 */

import { NextRequest, NextResponse } from 'next/server';

const startedAt = Date.now();

// ============================================
// In-memory rate limiter for the health endpoint
// ============================================
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;  // max 10 per minute per IP

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Periodically clean up stale entries to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}

function getClientIp(request: NextRequest): string {
  // Prefer X-Forwarded-For (set by reverse proxies / load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first (leftmost) IP — the original client
    return forwarded.split(',')[0].trim();
  }
  // Fallback — unlikely in production behind a proxy
  return request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  cleanupRateLimitMap();
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

export async function GET(request: NextRequest) {
  // Rate limit check
  const clientIp = getClientIp(request);
  const { allowed, retryAfterMs } = checkRateLimit(clientIp);

  if (!allowed) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
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
