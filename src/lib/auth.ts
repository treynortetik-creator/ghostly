import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

// Cookie name for the auth token
const AUTH_COOKIE_NAME = 'counting-house-token';

// Token expiration time (24 hours)
const TOKEN_EXPIRATION = '24h';

interface TokenPayload extends JWTPayload {
  username: string;
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

  // Use timing-safe comparison to prevent timing attacks
  const passwordBuffer = Buffer.from(password);
  const envPasswordBuffer = Buffer.from(envPassword);

  // timingSafeEqual requires both buffers to be same length
  if (passwordBuffer.length !== envPasswordBuffer.length) {
    return false;
  }
  return timingSafeEqual(passwordBuffer, envPasswordBuffer);
}

/**
 * Create a JWT token for the authenticated user
 */
export async function createToken(username: string): Promise<string> {
  const secret = getJwtSecret();

  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
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
    const { payload } = await jwtVerify(token, secret);
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
