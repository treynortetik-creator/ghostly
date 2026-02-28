/**
 * API Route Helpers - DRY wrappers for common patterns
 *
 * withApiHandler: wraps a route handler with permission check + error handling
 * auditMutation: fire-and-forget audit logging without try/catch boilerplate
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PermissionScope } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';
import { logAudit, getActor, AuditParams } from '@/lib/audit';

interface ApiHandlerOptions {
  /** Required permission scope (read, write, admin) */
  permission: PermissionScope;
  /** Label for error messages, e.g. 'categories' */
  resource: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type HandlerFn = (request: NextRequest, context?: any) => Promise<NextResponse>;

/**
 * Wrap an API route handler with permission check + standardized error handling.
 *
 * Usage:
 *   export const GET = withApiHandler({ permission: 'read', resource: 'categories' },
 *     async (request) => {
 *       // ... your logic, just return NextResponse
 *     }
 *   );
 *
 * For dynamic routes with params:
 *   export const GET = withApiHandler({ permission: 'read', resource: 'categories' },
 *     async (request, { params }: { params: Promise<{ id: string }> }) => {
 *       const { id } = await params;
 *       // ...
 *     }
 *   );
 */
export function withApiHandler(
  options: ApiHandlerOptions,
  handler: HandlerFn
): HandlerFn {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const denied = requirePermission(request, options.permission);
    if (denied) return denied;

    try {
      return await handler(request, context);
    } catch (error) {
      const method = request.method;
      const requestId = request.headers.get('x-request-id') || undefined;
      console.error(`${options.resource} API error (${method}):`, error);
      logError(`Failed ${method} ${options.resource}`, {
        error: error as Error,
        source: `api/${options.resource}`,
        context: { method },
        requestId,
      });
      return NextResponse.json(
        { error: `Failed to process ${options.resource} request` },
        { status: 500 }
      );
    }
  };
}

/**
 * Extract the organization ID from the request.
 * Set by middleware for all authenticated requests.
 */
export function getOrgId(request: NextRequest): string {
  const orgId = request.headers.get('x-organization-id');
  if (!orgId) {
    throw new Error('Missing organization context — middleware should set x-organization-id');
  }
  return orgId;
}

/**
 * Fire-and-forget audit log. Swallows errors silently (logs to console).
 * Extracts actor from the request automatically.
 *
 * Usage:
 *   await auditMutation(request, {
 *     entity_type: 'category',
 *     entity_id: record.id,
 *     action: 'create',
 *   });
 */
export async function auditMutation(
  request: NextRequest,
  params: Omit<AuditParams, 'actor' | 'actor_type'>
): Promise<void> {
  try {
    const { actor, actor_type } = await getActor(request);
    logAudit({ ...params, actor, actor_type });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}
