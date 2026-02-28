/**
 * Ghostly - Organization Management API
 *
 * POST /api/organizations  — Create a new organization (+ add current user as owner)
 * GET  /api/organizations  — List organizations the current user belongs to
 *
 * These routes support both:
 *   1. Supabase Auth users (OAuth / magic link) — identified via Supabase session cookie
 *   2. Legacy cookie auth users — identified via x-auth-type header from middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to resolve the current Supabase Auth user from session cookies.
 * Returns null if Supabase Auth isn't configured or no session exists.
 */
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

/**
 * Get a Supabase admin client (service role) for direct DB operations.
 * Uses REST API via fetch for consistency with the rest of the codebase.
 */
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
// POST — Create organization
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Determine the authenticated user
    const authType = request.headers.get('x-auth-type')
    const supabaseUser = await getSupabaseUser()

    // Must be authenticated via either mechanism
    if (!supabaseUser && authType !== 'cookie') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, slug } = body

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }
    if (!slug || typeof slug !== 'string' || slug.trim().length < 3) {
      return NextResponse.json(
        { error: 'Slug must be at least 3 characters' },
        { status: 400 }
      )
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must contain only lowercase letters, numbers, and hyphens, and must start/end with a letter or number' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const checkRes = await supabaseRest(
      `organizations?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`
    )
    if (checkRes.ok) {
      const existing = await checkRes.json()
      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json(
          { error: 'An organization with this slug already exists' },
          { status: 409 }
        )
      }
    }

    // Create the organization
    const createRes = await supabaseRest('organizations', {
      method: 'POST',
      body: {
        name: name.trim(),
        slug: slug.trim(),
        plan_tier: 'free',
        settings: {},
      },
      prefer: 'return=representation',
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      console.error('Failed to create organization:', errText)
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      )
    }

    const [org] = await createRes.json()

    // Add the current user as owner
    const memberPayload: Record<string, unknown> = {
      organization_id: org.id,
      role: 'owner',
    }

    if (supabaseUser) {
      memberPayload.user_id = supabaseUser.id
      memberPayload.email = supabaseUser.email || null
      memberPayload.accepted_at = new Date().toISOString()
    } else {
      // Legacy auth — no real user_id, use legacy_username
      memberPayload.legacy_username = 'admin'
      memberPayload.accepted_at = new Date().toISOString()
    }

    const memberRes = await supabaseRest('org_members', {
      method: 'POST',
      body: memberPayload,
      prefer: 'return=representation',
    })

    if (!memberRes.ok) {
      const errText = await memberRes.text()
      console.error('Failed to create org member:', errText)
      // Don't fail the whole request — the org was created
    }

    return NextResponse.json(
      { success: true, organization: org },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create organization error:', error)
    return NextResponse.json(
      { error: 'An error occurred while creating the organization' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET — List user's organizations
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authType = request.headers.get('x-auth-type')
    const supabaseUser = await getSupabaseUser()

    if (!supabaseUser && authType !== 'cookie') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    let membershipsRes: Response

    if (supabaseUser) {
      // Supabase auth user — query by user_id
      membershipsRes = await supabaseRest(
        `org_members?user_id=eq.${supabaseUser.id}&select=organization_id,role,organizations(id,name,slug,plan_tier,created_at)`
      )
    } else {
      // Legacy auth — query by legacy_username
      membershipsRes = await supabaseRest(
        `org_members?legacy_username=eq.admin&select=organization_id,role,organizations(id,name,slug,plan_tier,created_at)`
      )
    }

    if (!membershipsRes.ok) {
      const errText = await membershipsRes.text()
      console.error('Failed to list organizations:', errText)
      return NextResponse.json(
        { error: 'Failed to retrieve organizations' },
        { status: 500 }
      )
    }

    const memberships = await membershipsRes.json()

    // Flatten to org objects with role
    const organizations = (memberships || []).map(
      (m: { role: string; organizations: Record<string, unknown> }) => ({
        ...m.organizations,
        role: m.role,
      })
    )

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error('List organizations error:', error)
    return NextResponse.json(
      { error: 'An error occurred while listing organizations' },
      { status: 500 }
    )
  }
}
