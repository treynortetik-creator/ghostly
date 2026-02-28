import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createToken, setAuthCookie } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logAudit, AUTH_ENTITY_ID } from '@/lib/audit';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const rateCheck = await checkRateLimit(`login:${ip}`, MAX_ATTEMPTS, WINDOW_MS);

    if (!rateCheck.allowed) {
      // Audit: rate-limited login attempt (fire-and-forget)
      logAudit({
        entity_type: 'auth',
        entity_id: AUTH_ENTITY_ID,
        action: 'login_rate_limited',
        actor: 'unknown',
        actor_type: 'system',
        metadata: { ip },
      });

      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateCheck.resetAt.getTime() - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Verify credentials against env vars
    if (!verifyCredentials(username, password)) {
      // Audit: failed login attempt (fire-and-forget)
      logAudit({
        entity_type: 'auth',
        entity_id: AUTH_ENTITY_ID,
        action: 'login_failure',
        actor: username,
        actor_type: 'user',
        metadata: { ip, attempted_username: username },
      });

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await createToken(username);

    // Set the auth cookie
    await setAuthCookie(token);

    // Audit: successful login (fire-and-forget)
    logAudit({
      entity_type: 'auth',
      entity_id: AUTH_ENTITY_ID,
      action: 'login_success',
      actor: username,
      actor_type: 'user',
      metadata: { ip },
    });

    return NextResponse.json(
      { success: true, message: 'Logged in successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
