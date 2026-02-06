import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';

export async function GET(request: NextRequest) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { user: { username: session.username } },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get session error:', error);
    logError('Failed to get session', { error: error as Error, source: 'api/auth/me', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'An error occurred while getting session' },
      { status: 500 }
    );
  }
}
