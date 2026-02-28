import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { createHash, timingSafeEqual, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Cookie name for the auth token
const AUTH_COOKIE_NAME = 'ghostly-token';

// Token expiration time (24 hours)
const TOKEN_EXPIRATION = '24h';

interface TokenPayload extends JWTPayload {
  username: string;
}

export interface ApiKeyRecord {
  id: string;
  key_hash: string;
  agent_name: string;
  label: string | null;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

export interface ApiKeyAuthResult {
  authenticated: boolean;
  apiKey?: ApiKeyRecord;
  error?: string;
  errorCode?: string;
}

/**
 * Get the JWT secret as a Uint8Array for jose
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Verify credentials against environment variables
 */
export function verifyCredentials(username: string, password: string): boolean {
  const envUsername = process.env.AUTH_USERNAME;
  const envPassword = process.env.AUTH_PASSWORD;

  if (!envUsername || !envPassword) {
    console.error('AUTH_USERNAME or AUTH_PASSWORD environment variables not set');
    return false;
  }

  // Use timing-safe comparison for password to prevent timing attacks
  // For username, simple comparison is fine since it's not secret
  if (username !== envUsername) {
    return false;
  }

  // Hash both passwords to ensure constant-time comparison regardless of length
  const passwordHash = createHash('sha256').update(password).digest();
  const envPasswordHash = createHash('sha256').update(envPassword).digest();
  return timingSafeEqual(passwordHash, envPasswordHash);
}

/**
 * Create a JWT token for the authenticated user
 */
export async function createToken(username: string): Promise<string> {
  const secret = getJwtSecret();

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('ghostly')
    .setAudience('ghostly')
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(secret);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'ghostly',
      audience: 'ghostly',
    });
    return payload as TokenPayload;
  } catch {
    // Token is invalid or expired
    return null;
  }
}

/**
 * Get the current session from the auth cookie
 * Must be called from a Server Component or Route Handler
 */
export async function getSession(): Promise<{ username: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.username) {
      return null;
    }

    return { username: payload.username };
  } catch {
    return null;
  }
}

/**
 * Set the auth cookie with the token
 * Must be called from a Route Handler
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours in seconds
  });
}

/**
 * Clear the auth cookie
 * Must be called from a Route Handler
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

/**
 * Export the cookie name for use in middleware
 */
export { AUTH_COOKIE_NAME };

// ============================================
// API Key Authentication
// ============================================

/**
 * Hash an API key with SHA-256 for storage/lookup
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generate a new API key in the format sk_{agent}_{env}_{random32}
 */
export function generateApiKey(agentName: string, environment: string = 'live'): string {
  const random = randomBytes(32).toString('base64url'); // 256-bit entropy, ~43 chars
  return `sk_${agentName}_${environment}_${random}`;
}

/**
 * Validate an API key against the database.
 * Uses the Supabase REST API directly (works in both Node and Edge runtimes).
 */
export async function validateApiKey(rawKey: string): Promise<ApiKeyAuthResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { authenticated: false, error: 'Server configuration error', errorCode: 'INTERNAL_ERROR' };
  }

  const keyHash = hashApiKey(rawKey);

  // Query the api_keys table via Supabase REST API
  const url = `${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${keyHash}&revoked_at=is.null&is_active=eq.true&select=*`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
  });

  if (!res.ok) {
    return { authenticated: false, error: 'Internal server error', errorCode: 'INTERNAL_ERROR' };
  }

  const rows: ApiKeyRecord[] = await res.json();

  if (rows.length === 0) {
    return { authenticated: false, error: 'Invalid or missing API key', errorCode: 'AUTH_INVALID_KEY' };
  }

  const apiKey = rows[0];

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { authenticated: false, error: 'API key has expired', errorCode: 'AUTH_KEY_EXPIRED' };
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

  return { authenticated: true, apiKey };
}

/**
 * Check if an API key has the required permission scope
 */
export function apiKeyHasPermission(apiKey: ApiKeyRecord, requiredScope: string): boolean {
  return apiKey.permissions.includes(requiredScope);
}
