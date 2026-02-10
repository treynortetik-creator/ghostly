/**
 * The Counting House - Event Documents API
 *
 * GET /api/events/:id/documents - List documents for an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = requirePermission(request, 'read');
    if (denied) return denied;

    const { id } = await params;
    const supabase = await createClient();

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('event_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      documents: documents || [],
      event: { id: event.id, name: event.name },
    });
  } catch (err) {
    console.error('Event documents error:', err);
    logError('Failed to fetch event documents', { error: err as Error, source: 'api/events/[id]/documents', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to fetch event documents' },
      { status: 500 }
    );
  }
}
