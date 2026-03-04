/**
 * Ghostly - Supabase Server Client
 * Creates Supabase clients for use in API Route Handlers.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Creates a Supabase client for server-side usage (API routes only).
 * Uses the service role key to bypass RLS — auth and org scoping are
 * handled by middleware (x-organization-id header), not Postgres roles.
 *
 * IMPORTANT: Do NOT use createServerClient from @supabase/ssr here.
 * That variant reads auth cookies and uses the user's JWT instead of
 * the service role key, causing RLS violations for OAuth users.
 */
export function createClient() {
  return createSupabaseClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
