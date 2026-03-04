/**
 * Ghostly - Onboarding API
 *
 * POST /api/onboarding — Create org + owner membership + API key for a new user
 *
 * Supports both Supabase Auth users and legacy cookie auth users.
 * Returns the raw API key once — it cannot be retrieved again.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateApiKey, hashApiKey, getSession } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
  options: { method?: string; body?: unknown; prefer?: string } = {}
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

  return fetch(`${creds.url}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
}

// ---------------------------------------------------------------------------
// POST — Onboarding: create org + membership + API key
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Authenticate the user (Supabase first, then legacy fallback)
    const supabaseUser = await getSupabaseUser()
    const legacySession = !supabaseUser ? await getSession() : null

    if (!supabaseUser && !legacySession) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Parse & validate input
    const body = await request.json()
    const { orgName } = body

    if (!orgName || typeof orgName !== 'string' || orgName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      )
    }

    const trimmedName = orgName.trim()
    const orgSlug = slugify(trimmedName)

    if (orgSlug.length < 3) {
      return NextResponse.json(
        { error: 'Organization name is too short (slug must be at least 3 characters)' },
        { status: 400 }
      )
    }

    // 3. Check slug uniqueness
    const checkRes = await supabaseRest(
      `organizations?slug=eq.${encodeURIComponent(orgSlug)}&select=id&limit=1`
    )
    if (checkRes.ok) {
      const existing = await checkRes.json()
      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json(
          { error: 'An organization with this name already exists. Try a different name.' },
          { status: 409 }
        )
      }
    }

    // 4. Create the organization
    const createRes = await supabaseRest('organizations', {
      method: 'POST',
      body: {
        name: trimmedName,
        slug: orgSlug,
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

    // 5. Add user as owner in org_members
    const memberPayload: Record<string, unknown> = {
      organization_id: org.id,
      role: 'owner',
      accepted_at: new Date().toISOString(),
    }

    if (supabaseUser) {
      memberPayload.user_id = supabaseUser.id
      memberPayload.email = supabaseUser.email || null
    } else if (legacySession) {
      memberPayload.legacy_username = legacySession.username
    }

    const memberRes = await supabaseRest('organization_members', {
      method: 'POST',
      body: memberPayload,
      prefer: 'return=representation',
    })

    if (!memberRes.ok) {
      const errText = await memberRes.text()
      console.error('Failed to create org member:', errText)
      // Continue — org was created, membership failure shouldn't block entirely
    }

    // 6. Generate API key
    const rawKey = generateApiKey(orgSlug, 'live')
    const keyHash = hashApiKey(rawKey)

    const keyRes = await supabaseRest('api_keys', {
      method: 'POST',
      body: {
        organization_id: org.id,
        key_hash: keyHash,
        agent_name: orgSlug,
        label: 'Default API Key',
        permissions: ['read', 'write', 'admin'],
      },
      prefer: 'return=representation',
    })

    if (!keyRes.ok) {
      const errText = await keyRes.text()
      console.error('Failed to create API key:', errText)
      // Still return org info even if key creation failed
    }

    // 7. Set active org cookie
    const cookieStore = await cookies()
    cookieStore.set('ghostly-active-org', org.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    // 8. Return result
    return NextResponse.json(
      {
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
        apiKey: rawKey,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'An error occurred during onboarding' },
      { status: 500 }
    )
  }
}
