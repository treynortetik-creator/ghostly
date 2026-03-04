/**
 * Ghostly - Organization Switch API
 *
 * POST /api/organizations/switch
 * Body: { organizationId: string }
 *
 * Validates the user has membership in the target org, then sets the
 * ghostly-active-org cookie and returns the org details.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ---------------------------------------------------------------------------
// Helpers (same pattern as ../route.ts)
// ---------------------------------------------------------------------------

async function getSupabaseUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return null

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Read-only in route handlers for this use case
        },
      },
    })

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

function getServiceCredentials() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

async function supabaseRest(
  path: string,
  options: {
    method?: string
    body?: unknown
    prefer?: string
  } = {}
) {
  const creds = getServiceCredentials()
  if (!creds) throw new Error('Supabase service credentials not configured')

  const headers: Record<string, string> = {
    apikey: creds.key,
    Authorization: `Bearer ${creds.key}`,
    'Content-Type': 'application/json',
  }
  if (options.prefer) {
    headers['Prefer'] = options.prefer
  }

  const res = await fetch(`${creds.url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  return res
}

// ---------------------------------------------------------------------------
// POST - Switch active organization
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Determine the authenticated user
    const authType = request.headers.get('x-auth-type')
    const supabaseUser = await getSupabaseUser()

    if (!supabaseUser && authType !== 'cookie') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { organizationId } = body

    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      )
    }

    // Verify user has membership in the target org
    let membershipQuery: string

    if (supabaseUser) {
      membershipQuery = `organization_members?user_id=eq.${supabaseUser.id}&organization_id=eq.${encodeURIComponent(organizationId)}&select=organization_id,role,organizations(id,name,slug)`
    } else {
      membershipQuery = `organization_members?legacy_username=eq.admin&organization_id=eq.${encodeURIComponent(organizationId)}&select=organization_id,role,organizations(id,name,slug)`
    }

    const membershipRes = await supabaseRest(membershipQuery)

    if (!membershipRes.ok) {
      const errText = await membershipRes.text()
      console.error('Failed to verify org membership:', errText)
      return NextResponse.json(
        { error: 'Failed to verify organization membership' },
        { status: 500 }
      )
    }

    const memberships = await membershipRes.json()

    if (!Array.isArray(memberships) || memberships.length === 0) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 }
      )
    }

    const membership = memberships[0]
    const org = membership.organizations

    if (!org || !org.id) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Set the active org cookie (same options as onboarding route)
    const cookieStore = await cookies()
    cookieStore.set('ghostly-active-org', org.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    })
  } catch (error) {
    console.error('Switch organization error:', error)
    return NextResponse.json(
      { error: 'An error occurred while switching organizations' },
      { status: 500 }
    )
  }
}
