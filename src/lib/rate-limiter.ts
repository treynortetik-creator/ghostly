/**
 * Database-Backed Rate Limiter
 *
 * Uses Supabase (rate_limit_entries table) for persistence across restarts
 * and horizontal scaling. Replaces in-memory Map-based rate limiting.
 *
 * Uses the Supabase REST API directly (like the middleware) so it works
 * in both Node and Edge runtimes without importing the SSR client.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

interface RateLimitOptions {
  /**
   * When true, allow traffic if the limiter backend is unavailable.
   * For security-sensitive endpoints (login), set this to false.
   */
  failOpenOnError?: boolean;
}

/**
 * Check and increment the rate limit counter for a given key.
 *
 * - `key`:       Unique identifier (e.g., IP address, "login:<ip>")
 * - `limit`:     Max requests allowed in the window
 * - `windowMs`:  Window duration in milliseconds
 *
 * Returns whether the request is allowed, how many remain, and when the window resets.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const failOpenOnError = options.failOpenOnError ?? true;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    const resetAt = new Date(Date.now() + windowMs);
    if (failOpenOnError) {
      console.warn('Rate limiter: backend env vars missing, failing open');
      return { allowed: true, remaining: limit, resetAt };
    }
    console.error('Rate limiter: backend env vars missing, failing closed');
    return { allowed: false, remaining: 0, resetAt };
  }

  const now = Date.now();
  const resetAt = new Date(now + windowMs);
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const headers = {
    'apikey': supabaseServiceKey,
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_rate_limit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Rate limiter RPC failed:', body);
      if (failOpenOnError) {
        return { allowed: true, remaining: limit, resetAt };
      }
      return { allowed: false, remaining: 0, resetAt };
    }

    const data = await res.json();
    if (!data || typeof data !== 'object') {
      if (failOpenOnError) {
        return { allowed: true, remaining: limit, resetAt };
      }
      return { allowed: false, remaining: 0, resetAt };
    }

    const rpcResetAt = typeof data.reset_at === 'string'
      ? new Date(data.reset_at)
      : resetAt;

    return {
      allowed: data.allowed === true,
      remaining: Number.isFinite(Number(data.remaining)) ? Number(data.remaining) : 0,
      resetAt: Number.isNaN(rpcResetAt.getTime()) ? resetAt : rpcResetAt,
    };
  } catch (err) {
    console.error('Rate limiter error:', err);
    if (failOpenOnError) {
      return { allowed: true, remaining: limit, resetAt };
    }
    return { allowed: false, remaining: 0, resetAt };
  }
}

/**
 * Clean up expired rate limit entries.
 * Should be called periodically (e.g., from admin/cleanup).
 * Deletes entries older than 1 hour.
 */
export async function cleanupRateLimitEntries(): Promise<number> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return 0;
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/rate_limit_entries?window_start=lt.${encodeURIComponent(oneHourAgo)}&select=id`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=representation',
        },
      }
    );

    if (!res.ok) {
      console.error('Rate limit cleanup failed:', await res.text());
      return 0;
    }

    const deleted: { id: string }[] = await res.json();
    return deleted.length;
  } catch (err) {
    console.error('Rate limit cleanup error:', err);
    return 0;
  }
}
