/**
 * Ghostly - Supabase Browser Client
 * Creates a Supabase client for use in Client Components (browser-side).
 * Uses the anon key for RLS-based auth (OAuth, magic link).
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Whether Supabase Auth is configured (anon key present).
 * When false, the app falls back to legacy username/password auth.
 */
export const isSupabaseAuthEnabled =
  typeof process !== 'undefined' &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Create a Supabase client for browser-side usage.
 * Only call this when isSupabaseAuthEnabled is true.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
