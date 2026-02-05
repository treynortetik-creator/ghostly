import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Cookie name must match the one in auth.ts
const AUTH_COOKIE_NAME = 'counting-house-token';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login'];

// API routes that don't require authentication
const PUBLIC_API_ROUTES = ['/api/auth/login', '/api/auth/logout', '/api/health'];

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
    pathname.includes('.')
  ) {
    return true;
  }

  return false;
}

/**
 * Verify the JWT token from cookie
 */
async function verifyTokenFromCookie(token: string): Promise<boolean> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not set in middleware');
      return false;
    }

    const secretKey = new TextEncoder().encode(secret);
    await jwtVerify(token, secretKey);
    return true;
  } catch {
    return false;
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

  const url = `${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${encodeURIComponent(keyHash)}&revoked_at=is.null&is_active=eq.true&select=id,agent_name,permissions,expires_at`;
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
  }).catch(() => { /* non-critical */ });

  return {
    valid: true,
    agentName: apiKey.agent_name,
    permissions: apiKey.permissions,
    apiKeyId: apiKey.id,
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    if (pathname === '/login') {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (token) {
        const isValid = await verifyTokenFromCookie(token);
        if (isValid) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    }
    return NextResponse.next();
  }

  // For API routes, check x-api-key header first
  if (pathname.startsWith('/api/')) {
    const apiKeyHeader = request.headers.get('x-api-key');

    if (apiKeyHeader) {
      const result = await validateApiKeyInMiddleware(apiKeyHeader);

      if (!result.valid) {
        return NextResponse.json(
          { error: result.error, code: result.errorCode },
          { status: result.status || 401 }
        );
      }

      // API key is valid — pass auth context to route handlers via headers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-auth-type', 'api_key');
      requestHeaders.set('x-auth-agent-name', result.agentName!);
      requestHeaders.set('x-auth-permissions', JSON.stringify(result.permissions!));
      requestHeaders.set('x-auth-api-key-id', result.apiKeyId!);

      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }

    // No API key — fall through to cookie auth for API routes
  }

  // Check for auth cookie on protected routes
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify the token
  const isValid = await verifyTokenFromCookie(token);

  if (!isValid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Invalid or expired token', code: 'AUTH_INVALID_TOKEN' },
        { status: 401 }
      );
    }

    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  // Cookie auth valid — pass auth context via headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-auth-type', 'cookie');

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
