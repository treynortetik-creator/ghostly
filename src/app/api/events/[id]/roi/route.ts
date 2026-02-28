/**
 * Ghostly - Event ROI API
 *
 * GET /api/events/[id]/roi - Get ROI summary with computed metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from '@/lib/api-helpers';
import type { EventTypeRecord } from '@/types/database';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'events/roi' },
  async (_request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, event_types(*)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (eventError?.code === 'PGRST116' || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (eventError) throw eventError;

    // Get actual spent from expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('amount')
      .eq('event_id', id)
      .is('deleted_at', null);

    if (expensesError) throw expensesError;

    const actualSpent = (expenses || []).reduce((sum, e) => sum + e.amount, 0);

    const pipelineGenerated = event.pipeline_generated ?? 0;
    const revenueClosed = event.revenue_closed ?? 0;
    const leadsGenerated = event.leads_generated ?? 0;
    const meetingsBooked = event.meetings_booked ?? 0;
    const opportunitiesCreated = event.opportunities_created ?? 0;

    // Compute ROI metrics (null when divisor is zero)
    const roiRatio = actualSpent > 0
      ? (revenueClosed - actualSpent) / actualSpent
      : null;
    const costPerLead = leadsGenerated > 0
      ? actualSpent / leadsGenerated
      : null;
    const costPerMeeting = meetingsBooked > 0
      ? actualSpent / meetingsBooked
      : null;
    const pipelineToSpendRatio = actualSpent > 0
      ? pipelineGenerated / actualSpent
      : null;

    // Extract event_types join result and rename to event_type_record
    const { event_types, ...eventData } = event as typeof event & { event_types: EventTypeRecord | null };

    return NextResponse.json({
      event_id: id,
      event_name: eventData.name,
      event_type_id: eventData.event_type_id ?? null,
      event_type_record: event_types ?? null,
      actual_spent: actualSpent,
      pipeline_generated: pipelineGenerated,
      revenue_closed: revenueClosed,
      leads_generated: leadsGenerated,
      meetings_booked: meetingsBooked,
      opportunities_created: opportunitiesCreated,
      roi_notes: eventData.roi_notes ?? null,
      roi_ratio: roiRatio,
      cost_per_lead: costPerLead,
      cost_per_meeting: costPerMeeting,
      pipeline_to_spend_ratio: pipelineToSpendRatio,
    });
  }
);
