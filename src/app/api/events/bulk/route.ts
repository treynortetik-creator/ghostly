/**
 * Ghostly - Bulk Event Operations API
 *
 * POST /api/events/bulk
 * Supports actions: update_stage, delete
 * All events must belong to the current org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

const VALID_STAGES = ['confirmed', 'in_progress', 'ready', 'active', 'debrief', 'archived'];

export const POST = withApiHandler({ permission: 'write', resource: 'events' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    const { action, event_ids, stage } = body;

    // Validate action
    if (!action || !['update_stage', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "update_stage" or "delete".' },
        { status: 400 }
      );
    }

    // Validate event_ids
    if (!Array.isArray(event_ids) || event_ids.length === 0) {
      return NextResponse.json(
        { error: 'event_ids must be a non-empty array.' },
        { status: 400 }
      );
    }

    if (event_ids.length > 100) {
      return NextResponse.json(
        { error: 'Cannot process more than 100 events at once.' },
        { status: 400 }
      );
    }

    // Validate stage for update_stage action
    if (action === 'update_stage') {
      if (!stage || !VALID_STAGES.includes(stage)) {
        return NextResponse.json(
          { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Verify all events belong to this org and are not deleted
    const { data: validEvents, error: fetchError } = await supabase
      .from('events')
      .select('id')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('id', event_ids);

    if (fetchError) throw fetchError;

    const validIds = new Set((validEvents || []).map(e => e.id));
    const errors: string[] = [];

    // Track which IDs were not found/valid
    for (const id of event_ids) {
      if (!validIds.has(id)) {
        errors.push(`Event ${id} not found or not accessible.`);
      }
    }

    const idsToProcess = event_ids.filter((id: string) => validIds.has(id));
    let updated = 0;

    if (idsToProcess.length > 0) {
      if (action === 'update_stage') {
        const { error: updateError, count } = await supabase
          .from('events')
          .update({
            stage,
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .in('id', idsToProcess);

        if (updateError) throw updateError;
        updated = count ?? idsToProcess.length;

        // Audit log
        await auditMutation(request, {
          entity_type: 'event',
          entity_id: 'bulk',
          action: 'update',
          changes: { stage: { old: 'various', new: stage } },
          metadata: { event_ids: idsToProcess, count: updated },
        });
      } else if (action === 'delete') {
        const { error: deleteError, count } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .in('id', idsToProcess);

        if (deleteError) throw deleteError;
        updated = count ?? idsToProcess.length;

        // Audit log
        await auditMutation(request, {
          entity_type: 'event',
          entity_id: 'bulk',
          action: 'delete',
          changes: null,
          metadata: { event_ids: idsToProcess, count: updated },
        });
      }
    }

    return NextResponse.json({
      updated,
      failed: errors.length,
      errors,
    });
  }
);
