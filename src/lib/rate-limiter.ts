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
  windowMs: number
): Promise<RateLimitResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // If DB is unavailable, fail open — allow the request but log a warning
    console.warn('Rate limiter: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set, failing open');
    return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + windowMs) };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  const headers = {
    'apikey': supabaseServiceKey,
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  try {
    // Step 1: Count existing requests in the current window
    const countUrl = `${supabaseUrl}/rest/v1/rate_limit_entries?key=eq.${encodeURIComponent(key)}&window_start=gte.${encodeURIComponent(windowStart.toISOString())}&select=id,count`;
    const countRes = await fetch(countUrl, { headers });

    if (!countRes.ok) {
      console.error('Rate limiter: failed to query rate_limit_entries', await countRes.text());
      return { allowed: true, remaining: limit, resetAt: new Date(now.getTime() + windowMs) };
    }

    const entries: { id: string; count: number }[] = await countRes.json();

    // Sum up all counts in the current window
    const totalCount = entries.reduce((sum, entry) => sum + (entry.count || 1), 0);

    const resetAt = new Date(now.getTime() + windowMs);

    if (totalCount >= limit) {
      // Rate limited — don't insert a new entry
      return { allowed: false, remaining: 0, resetAt };
    }

    // Step 2: Try to upsert — increment if a row for the current window-second exists,
    // otherwise insert a new row. We use the truncated-to-second timestamp as the window
    // start to batch requests in the same second.
    const windowSecond = new Date(Math.floor(now.getTime() / 1000) * 1000);

    // Try to find and increment an existing entry for this second
    const existingUrl = `${supabaseUrl}/rest/v1/rate_limit_entries?key=eq.${encodeURIComponent(key)}&window_start=eq.${encodeURIComponent(windowSecond.toISOString())}&select=id,count`;
    const existingRes = await fetch(existingUrl, { headers });

    if (existingRes.ok) {
      const existing: { id: string; count: number }[] = await existingRes.json();

      if (existing.length > 0) {
        // Increment existing entry
        const entry = existing[0];
        await fetch(`${supabaseUrl}/rest/v1/rate_limit_entries?id=eq.${entry.id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ count: entry.count + 1 }),
        });
      } else {
        // Insert new entry
        await fetch(`${supabaseUrl}/rest/v1/rate_limit_entries`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            key,
            window_start: windowSecond.toISOString(),
            count: 1,
          }),
        });
      }
    }

    const remaining = Math.max(0, limit - totalCount - 1);
    return { allowed: true, remaining, resetAt };
  } catch (err) {
    // On any error, fail open to avoid blocking legitimate requests
    console.error('Rate limiter error:', err);
    return { allowed: true, remaining: limit, resetAt: new Date(now.getTime() + windowMs) };
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
