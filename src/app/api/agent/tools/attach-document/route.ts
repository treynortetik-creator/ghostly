/**
 * Agent Tool API - Attach Document to Event
 *
 * POST /api/agent/tools/attach-document
 * Links a document to an event by setting the document's event_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const POST = withApiHandler({ permission: 'write', resource: 'documents' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    const { document_id, event_id } = body;

    if (!document_id || !event_id) {
      return NextResponse.json(
        { error: 'Missing required fields: document_id, event_id' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Verify document exists in this org
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', document_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Document not found or does not belong to this organization' },
        { status: 404 }
      );
    }

    // Verify event exists in this org
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', event_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found or does not belong to this organization' },
        { status: 404 }
      );
    }

    // Link document to event
    const { error: updateError } = await supabase
      .from('documents')
      .update({ event_id })
      .eq('id', document_id)
      .eq('organization_id', orgId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Document linked to event "${event.name}"`,
    });
  }
);
