/**
 * Ghostly - Error Logs API
 *
 * GET    /api/admin/errors - List error logs (admin only)
 * POST   /api/admin/errors - Log an error from client (admin only)
 * DELETE /api/admin/errors - Clear error logs (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getErrorLogs, clearErrorLogs, logError } from '@/lib/error-logger';
import { withApiHandler } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'admin', resource: 'admin/errors' },
  async (request: NextRequest) => {
    // Additional session check (admin must be a real user, not API key)
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') as 'error' | 'warn' | 'info' | null;
    const source = searchParams.get('source');
    const limit = searchParams.get('limit');

    const logs = getErrorLogs({
      level: level || undefined,
      source: source || undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });

    return NextResponse.json({ logs, total: logs.length });
  }
);

export const POST = withApiHandler({ permission: 'admin', resource: 'admin/errors' },
  async (request: NextRequest) => {
    const body = await request.json();
    const entry = logError(body.message, {
      level: body.level || 'error',
      context: body.context,
      source: body.source || 'client',
      url: body.url,
    });
    return NextResponse.json({ success: true, id: entry.id });
  }
);

export const DELETE = withApiHandler({ permission: 'admin', resource: 'admin/errors' },
  async () => {
    // Additional session check (admin must be a real user, not API key)
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    clearErrorLogs();
    return NextResponse.json({ success: true });
  }
);
