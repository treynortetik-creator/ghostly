/**
 * Idempotency Key Support
 *
 * Ensures safe retries for POST/PUT requests by caching responses
 * keyed by a client-provided Idempotency-Key header.
 *
 * - If no header is present, the request proceeds normally (opt-in).
 * - If the key exists with a cached response, return it immediately.
 * - If the key exists but has no response yet (in-flight), return 409 Conflict.
 * - If the key is new, claim it, process the request, then cache the response.
 * - Keys expire after 24 hours.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

/**
 * Wraps a POST/PUT route handler with idempotency key support.
 * Requests without an Idempotency-Key header pass through unchanged.
 */
export function withIdempotency(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest): Promise<NextResponse> => {
    const idempotencyKey = request.headers.get('idempotency-key');

    // No key provided — pass through normally
    if (!idempotencyKey) {
      return handler(request);
    }

    // Validate key format (must be non-empty, max 256 chars)
    if (idempotencyKey.length > 256) {
      return NextResponse.json(
        { error: 'Idempotency-Key must be 256 characters or fewer' },
        { status: 400 }
      );
    }

    const method = request.method;
    const path = new URL(request.url).pathname;
    const supabase = createClient();

    // Check for existing key
    const { data: existing } = await supabase
      .from('idempotency_keys')
      .select('status_code, response_body, expires_at')
      .eq('key', idempotencyKey)
      .single();

    if (existing) {
      // Check if expired
      if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
        // Expired key — delete it and proceed as new
        await supabase
          .from('idempotency_keys')
          .delete()
          .eq('key', idempotencyKey);
      } else if (existing.status_code !== null && existing.response_body !== null) {
        // Completed — return cached response
        return NextResponse.json(existing.response_body, {
          status: existing.status_code,
          headers: { 'Idempotency-Key': idempotencyKey },
        });
      } else {
        // In-flight (claimed but no response yet) — conflict
        return NextResponse.json(
          { error: 'A request with this Idempotency-Key is already being processed' },
          { status: 409 }
        );
      }
    }

    // Claim the key (insert with no response yet)
    const { error: insertError } = await supabase
      .from('idempotency_keys')
      .insert({
        key: idempotencyKey,
        method,
        path,
      });

    if (insertError) {
      // Race condition: another request claimed the key between our check and insert
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A request with this Idempotency-Key is already being processed' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    // Execute the actual handler
    const response = await handler(request);

    // Only cache successful (2xx) responses — error responses should not be
    // replayed because the client should be able to retry after fixing the issue.
    const responseBody = await response.clone().json();
    if (response.status >= 200 && response.status < 300) {
      await supabase
        .from('idempotency_keys')
        .update({
          status_code: response.status,
          response_body: responseBody as Json,
        })
        .eq('key', idempotencyKey);
    } else {
      // Release the key so the client can retry with the same idempotency key
      await supabase
        .from('idempotency_keys')
        .delete()
        .eq('key', idempotencyKey);
    }

    // Return the original response with the key echoed back
    return NextResponse.json(responseBody, {
      status: response.status,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  };
}

/**
 * Deletes expired idempotency keys.
 * Call periodically (e.g., from a cron endpoint or on startup).
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from('idempotency_keys')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  return data?.length ?? 0;
}
