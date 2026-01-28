import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Cookie name must match the one in auth.ts
const AUTH_COOKIE_NAME = 'counting-house-token';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login'];

// API routes that don't require authentication
const PUBLIC_API_ROUTES = ['/api/auth/login', '/api/auth/logout'];

/**
 * Check if a route is public (doesn't require auth)
 */
function isPublicRoute(pathname: string): boolean {
  // Check exact matches for pages
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }

  // Check API auth routes
  if (PUBLIC_API_ROUTES.includes(pathname)) {
    return true;
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // Static files with extensions
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // If user is already authenticated and trying to access login, redirect to home
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

  // Check for auth cookie on protected routes
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    // No token, redirect to login for pages, return 401 for API
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify the token
  const isValid = await verifyTokenFromCookie(token);

  if (!isValid) {
    // Invalid token, redirect to login for pages, return 401 for API
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Clear the invalid cookie and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  // Token is valid, continue
  return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
