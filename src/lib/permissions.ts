/**
 * Permission enforcement for API routes
 *
 * Checks x-auth-permissions header set by middleware
 * and returns a 403 response if the required scope is missing.
 */

import { NextRequest, NextResponse } from 'next/server';

export type PermissionScope = 'read' | 'write' | 'admin' | 'webhooks';

/**
 * Check if the current request has the required permission scope.
 * For cookie auth (browser users), all permissions are implicitly granted.
 * For API key auth, checks the permissions array from middleware headers.
 *
 * Returns null if authorized, or a NextResponse with 403 if not.
 *
 * Usage:
 *   const denied = requirePermission(request, 'write');
 *   if (denied) return denied;
 */
export function requirePermission(
  request: NextRequest,
  scope: PermissionScope
): NextResponse | null {
  const authType = request.headers.get('x-auth-type');

  // Cookie auth (browser user) — full access
  if (authType !== 'api_key') {
    return null;
  }

  // API key auth — check permissions
  let permissions: string[] = [];
  try {
    permissions = JSON.parse(request.headers.get('x-auth-permissions') || '[]');
  } catch {
    permissions = [];
  }

  if (!permissions.includes(scope)) {
    return NextResponse.json(
      {
        error: `API key does not have '${scope}' permission`,
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        required_scope: scope,
        current_scopes: permissions,
      },
      { status: 403 }
    );
  }

  return null;
}
