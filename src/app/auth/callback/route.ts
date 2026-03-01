/**
 * Ghostly - Auth Callback Route Handler
 * Exchanges the OAuth/magic-link code for a Supabase session,
 * then redirects the user to the dashboard (or onboarding if new).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error.message)
      // Redirect to login with error indicator
      return NextResponse.redirect(new URL('/login?error=auth_callback', request.url))
    }

    // Check if user has an org membership — if not, send to onboarding
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Query org_members for this user via the Supabase REST API (service role)
      // to determine whether they need onboarding.
      const supabaseUrl = process.env.SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (supabaseUrl && supabaseServiceKey) {
        try {
          const membersRes = await fetch(
            `${supabaseUrl}/rest/v1/org_members?user_id=eq.${user.id}&select=id&limit=1`,
            {
              headers: {
                apikey: supabaseServiceKey,
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
            }
          )

          if (membersRes.ok) {
            const members = await membersRes.json()
            if (!Array.isArray(members) || members.length === 0) {
              // New user with no org — send to onboarding
              return NextResponse.redirect(new URL('/onboarding', request.url))
            }
          }
        } catch (err) {
          // If the membership check fails, just continue to dashboard.
          // They can be redirected to onboarding later if needed.
          console.error('Org membership check failed:', err)
        }
      }
    }
  }

  // Default: redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
