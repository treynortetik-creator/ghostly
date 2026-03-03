import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Cookie name must match the one in auth.ts
const AUTH_COOKIE_NAME = 'ghostly-token';
const ACTIVE_ORG_COOKIE_NAME = 'ghostly-active-org';

/** Sentinel UUID for auth-related audit entries (matches AUTH_ENTITY_ID in audit.ts) */
const AUTH_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Fire-and-forget audit log via Supabase REST API (Edge-compatible).
 * Used in middleware where we can't import the SSR-based audit module.
 */
function logAuditFromMiddleware(params: {
  action: string;
  actor: string;
  actor_type: string;
  metadata?: Record<string, unknown> | null;
}): void {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return;

  fetch(`${supabaseUrl}/rest/v1/audit_log`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      entity_type: 'auth',
      entity_id: AUTH_ENTITY_ID,
      action: params.action,
      changes: null,
      actor: params.actor,
      actor_type: params.actor_type,
      metadata: params.metadata ?? null,
    }),
  }).catch((err) => {
    console.error('Middleware audit log failed:', err);
  });
}

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/'];

// API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/integrations/slack/oauth/callback',
  '/api/integrations/slack/events',
  '/api/integrations/slack/commands',
  '/api/waitlist',
];

/**
 * Check if a route is public (doesn't require auth)
 */
function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }

  if (PUBLIC_API_ROUTES.includes(pathname)) {
    return true;
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    (!pathname.startsWith('/api/') && pathname.includes('.'))
  ) {
    return true;
  }

  return false;
}

/**
 * Verify the JWT token from cookie
 */
async function verifyTokenFromCookie(token: string): Promise<{ username: string } | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not set in middleware');
      return null;
    }

    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'ghostly',
      audience: 'ghostly',
    });

    const username = typeof payload.username === 'string' ? payload.username : '';
    if (!username) return null;
    return { username };
  } catch {
    return null;
  }
}

/**
 * Hash an API key with SHA-256 using Web Crypto API (Edge-compatible)
 */
async function hashApiKeyEdge(rawKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate an API key via Supabase REST API (Edge-compatible)
 * Returns the api key record if valid, null otherwise with error details
 */
async function validateApiKeyInMiddleware(rawKey: string): Promise<{
  valid: boolean;
  agentName?: string;
  permissions?: string[];
  apiKeyId?: string;
  organizationId?: string;
  error?: string;
  errorCode?: string;
  status?: number;
}> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { valid: false, error: 'Server configuration error', errorCode: 'INTERNAL_ERROR', status: 500 };
  }

  const keyHash = await hashApiKeyEdge(rawKey);

  const url = `${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${encodeURIComponent(keyHash)}&revoked_at=is.null&is_active=eq.true&select=id,agent_name,permissions,expires_at,organization_id`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
  });

  if (!res.ok) {
    return { valid: false, error: 'Internal server error', errorCode: 'INTERNAL_ERROR', status: 500 };
  }

  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, error: 'Invalid or missing API key', errorCode: 'AUTH_INVALID_KEY', status: 401 };
  }

  const apiKey = rows[0];

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { valid: false, error: 'API key has expired', errorCode: 'AUTH_KEY_EXPIRED', status: 401 };
  }

  // Update last_used_at (fire and forget)
  fetch(`${supabaseUrl}/rest/v1/api_keys?id=eq.${apiKey.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  }).catch((err) => { console.error('Failed to update API key last_used_at:', err); });

  return {
    valid: true,
    agentName: apiKey.agent_name,
    permissions: apiKey.permissions,
    apiKeyId: apiKey.id,
    organizationId: apiKey.organization_id,
  };
}

async function getOrgIdsForLegacyUser(username: string): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !username) {
    return [];
  }

  const encodedUser = encodeURIComponent(username);
  const candidatePaths = [
    `org_members?legacy_username=eq.${encodedUser}&select=organization_id`,
    `organization_members?legacy_username=eq.${encodedUser}&select=organization_id`,
  ];

  for (const path of candidatePaths) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      });

      if (!response.ok) {
        continue;
      }

      const rows = await response.json();
      if (!Array.isArray(rows)) {
        return [];
      }

      return rows
        .map((row) => (typeof row?.organization_id === 'string' ? row.organization_id : null))
        .filter((value): value is string => !!value);
    } catch {
      continue;
    }
  }

  return [];
}

async function resolveCookieOrgId(params: {
  username: string;
  requestedOrgId: string | null;
  fallbackOrgId: string;
}): Promise<string> {
  const memberships = await getOrgIdsForLegacyUser(params.username);
  if (memberships.length === 0) {
    return params.fallbackOrgId;
  }

  if (params.requestedOrgId && memberships.includes(params.requestedOrgId)) {
    return params.requestedOrgId;
  }

  return memberships[0];
}

/**
 * Set X-Request-ID on a response for client correlation.
 */
function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('X-Request-ID', requestId);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate a unique request ID for tracing
  const requestId = crypto.randomUUID();

  // Default organization ID for backward-compatible single-tenant mode
  const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

  // Strip all internal auth headers to prevent client spoofing
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('x-auth-type');
  requestHeaders.delete('x-auth-agent-name');
  requestHeaders.delete('x-auth-permissions');
  requestHeaders.delete('x-auth-api-key-id');
  requestHeaders.delete('x-organization-id');

  // Set request ID on the request for downstream route handlers / logging
  requestHeaders.set('x-request-id', requestId);

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    if (pathname === '/login' || pathname === '/') {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (token) {
        const authContext = await verifyTokenFromCookie(token);
        if (authContext) {
          return withRequestId(NextResponse.redirect(new URL('/dashboard', request.url)), requestId);
        }
      }
    }
    return withRequestId(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId
    );
  }

  // For API routes, check x-api-key header first
  if (pathname.startsWith('/api/')) {
    const cronSecret = process.env.CRON_SECRET;

    // Dedicated auth path for heartbeat endpoint cron calls.
    const bearerAuth = request.headers.get('authorization');
    if (
      pathname === '/api/agent/heartbeat' &&
      cronSecret &&
      bearerAuth === `Bearer ${cronSecret}`
    ) {
      requestHeaders.set('x-auth-type', 'api_key');
      requestHeaders.set('x-auth-agent-name', 'internal-worker');
      requestHeaders.set('x-auth-permissions', JSON.stringify(['read', 'write', 'admin', 'webhooks']));
      requestHeaders.set('x-auth-api-key-id', 'internal-worker');
      requestHeaders.set('x-organization-id', DEFAULT_ORG_ID);

      return withRequestId(
        NextResponse.next({ request: { headers: requestHeaders } }),
        requestId
      );
    }

    // Internal worker auth for trusted server-to-server calls.
    // This enables scheduled agent jobs to call internal APIs/tools without user cookies.
    const internalSecret = request.headers.get('x-internal-cron-secret');
    if (cronSecret && internalSecret === cronSecret) {
      const internalOrgId = request.headers.get('x-internal-org-id');
      requestHeaders.set('x-auth-type', 'api_key');
      requestHeaders.set('x-auth-agent-name', 'internal-worker');
      requestHeaders.set('x-auth-permissions', JSON.stringify(['read', 'write', 'admin', 'webhooks']));
      requestHeaders.set('x-auth-api-key-id', 'internal-worker');
      requestHeaders.set('x-organization-id', internalOrgId || DEFAULT_ORG_ID);

      return withRequestId(
        NextResponse.next({ request: { headers: requestHeaders } }),
        requestId
      );
    }

    const apiKeyHeader = request.headers.get('x-api-key');

    if (apiKeyHeader) {
      const result = await validateApiKeyInMiddleware(apiKeyHeader);

      if (!result.valid) {
        return withRequestId(
          NextResponse.json(
            { error: result.error, code: result.errorCode },
            { status: result.status || 401 }
          ),
          requestId
        );
      }

      // API key is valid — pass auth context to route handlers via headers
      requestHeaders.set('x-auth-type', 'api_key');
      requestHeaders.set('x-auth-agent-name', result.agentName!);
      requestHeaders.set('x-auth-permissions', JSON.stringify(result.permissions!));
      requestHeaders.set('x-auth-api-key-id', result.apiKeyId!);
      requestHeaders.set('x-organization-id', result.organizationId || DEFAULT_ORG_ID);

      // Audit: API key auth usage (fire-and-forget)
      logAuditFromMiddleware({
        action: 'api_key_auth',
        actor: result.agentName!,
        actor_type: 'agent',
        metadata: {
          api_key_id: result.apiKeyId,
          pathname,
          method: request.method,
          request_id: requestId,
        },
      });

      return withRequestId(
        NextResponse.next({ request: { headers: requestHeaders } }),
        requestId
      );
    }

    // No API key — fall through to cookie auth for API routes
  }

  // Check for auth cookie on protected routes
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return withRequestId(
        NextResponse.json(
          { error: 'Authentication required', code: 'AUTH_REQUIRED' },
          { status: 401 }
        ),
        requestId
      );
    }
    return withRequestId(
      NextResponse.redirect(new URL('/login', request.url)),
      requestId
    );
  }

  // Verify the token
  const authContext = await verifyTokenFromCookie(token);

  if (!authContext) {
    if (pathname.startsWith('/api/')) {
      return withRequestId(
        NextResponse.json(
          { error: 'Invalid or expired token', code: 'AUTH_INVALID_TOKEN' },
          { status: 401 }
        ),
        requestId
      );
    }

    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return withRequestId(response, requestId);
  }

  // Cookie auth valid — pass auth context via headers
  const requestedOrgId =
    request.headers.get('x-org-id') ||
    request.headers.get('x-active-org-id') ||
    request.cookies.get(ACTIVE_ORG_COOKIE_NAME)?.value ||
    null;
  const resolvedOrgId = await resolveCookieOrgId({
    username: authContext.username,
    requestedOrgId,
    fallbackOrgId: DEFAULT_ORG_ID,
  });

  requestHeaders.set('x-auth-type', 'cookie');
  requestHeaders.set('x-organization-id', resolvedOrgId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (request.cookies.get(ACTIVE_ORG_COOKIE_NAME)?.value !== resolvedOrgId) {
    response.cookies.set(ACTIVE_ORG_COOKIE_NAME, resolvedOrgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return withRequestId(response, requestId);
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
