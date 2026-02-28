/**
 * Ghostly - Supabase Middleware Helper
 * Creates a Supabase client that can read/write cookies in Next.js middleware context.
 * Used for refreshing Supabase Auth sessions on each request.
 */

import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Create a Supabase client for middleware usage that can refresh sessions.
 * Returns both the client and the response (with updated cookies).
 *
 * Only useful when Supabase Auth is configured (NEXT_PUBLIC_SUPABASE_ANON_KEY present).
 */
export function createMiddlewareSupabaseClient(request: NextRequest) {
  // Start with a plain next response that we'll attach cookie updates to
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream middleware/handlers)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Create a new response with updated request and set cookies on it
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, response: supabaseResponse }
}
