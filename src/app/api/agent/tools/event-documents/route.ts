/**
 * Agent Tool API - Get Event Documents
 *
 * GET /api/agent/tools/event-documents
 * Returns documents attached to a specific event.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'documents' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing required parameter: event_id' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('documents')
      .select('id, filename, mime_type, file_size_bytes, ai_summary, ai_tags, created_at')
      .eq('event_id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      documents: data ?? [],
      total: (data ?? []).length,
    });
  }
);
