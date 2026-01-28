import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getErrorLogs, clearErrorLogs, logError } from '@/lib/error-logger';

export async function GET(request: NextRequest) {
  // Check authentication
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

export async function POST(request: NextRequest) {
  // Allow logging errors from client
  try {
    const body = await request.json();
    const entry = logError(body.message, {
      level: body.level || 'error',
      context: body.context,
      source: body.source || 'client',
      url: body.url,
    });
    return NextResponse.json({ success: true, id: entry.id });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  clearErrorLogs();
  return NextResponse.json({ success: true });
}
