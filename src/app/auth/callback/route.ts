/**
 * Ghostly - Auth Callback Route Handler
 * Exchanges the OAuth/magic-link code for a Supabase session,
 * then bridges it to a ghostly-token JWT so the middleware recognizes
 * the user on all subsequent requests.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createToken, AUTH_COOKIE_NAME } from '@/lib/auth'

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
      return NextResponse.redirect(new URL('/login?error=auth_callback', request.url))
    }

    // Get the authenticated user from Supabase
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Bridge: mint a ghostly-token JWT so middleware recognizes this session.
      // Use email as the username identifier.
      const username = user.email || user.id
      const token = await createToken(username)
      cookieStore.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      })

      // Check if user has an org membership — if not, send to onboarding
      const supabaseUrl = process.env.SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (supabaseUrl && supabaseServiceKey) {
        try {
          const membersRes = await fetch(
            `${supabaseUrl}/rest/v1/organization_members?user_id=eq.${user.id}&select=id&limit=1`,
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
              return NextResponse.redirect(new URL('/onboarding', request.url))
            }
          }
        } catch (err) {
          console.error('Org membership check failed:', err)
        }
      }
    }
  }

  // Default: redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
