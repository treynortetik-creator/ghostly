import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
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
    return NextResponse.json(
      { error: 'An error occurred while getting session' },
      { status: 500 }
    );
  }
}
