/**
 * The Counting House - Supabase Browser Client
 * Creates a Supabase client for use in browser/client components
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Creates a Supabase client for browser/client-side usage
 * Use this in React Client Components (files with 'use client')
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Singleton instance for convenience
 * Note: In most cases, prefer using createClient() to ensure fresh state
 */
let browserClient: ReturnType<typeof createClient> | null = null;

export function getClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}
