/**
 * Ghostly - Clone Event API
 *
 * POST /api/events/[id]/clone
 * Creates a duplicate of the event with:
 * - Copied: event settings, budget, tier, goals, notes fields, team assignments, checklist items (reset to uncompleted)
 * - NOT copied: expenses, ROI data, completed checklist state
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withApiHandler({ permission: 'write', resource: 'events' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const supabase = createClient();

    // Fetch the source event
    const { data: sourceEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (fetchError?.code === 'PGRST116' || !sourceEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    if (fetchError) throw fetchError;

    // Build the new event data
    const newName = body.name || `${sourceEvent.name} (Copy)`;
    const newDateStart = body.date_start || null;
    const newDateEnd = body.date_end || null;

    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert({
        organization_id: orgId,
        name: newName,
        event_type_id: sourceEvent.event_type_id,
        quarter: sourceEvent.quarter,
        fiscal_year_id: sourceEvent.fiscal_year_id,
        date_start: newDateStart,
        date_end: newDateEnd,
        location: sourceEvent.location,
        budget_amount: sourceEvent.budget_amount,
        expansion_goal: sourceEvent.expansion_goal,
        net_new_goal: sourceEvent.net_new_goal,
        approach_notes: sourceEvent.approach_notes,
        marketing_notes: sourceEvent.marketing_notes,
        sales_notes: sourceEvent.sales_notes,
        // ROI fields reset to 0
        pipeline_generated: 0,
        revenue_closed: 0,
        leads_generated: 0,
        meetings_booked: 0,
        opportunities_created: 0,
        roi_notes: null,
        // Keep tier and stage defaults
        tier: sourceEvent.tier,
        stage: 'confirmed',
        shipping_handler: sourceEvent.shipping_handler,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    // Clone team assignments
    const { data: teamAssignments } = await supabase
      .from('event_team_assignments')
      .select('team_member_id, event_role, notes')
      .eq('event_id', id);

    if (teamAssignments && teamAssignments.length > 0) {
      const newAssignments = teamAssignments.map(a => ({
        event_id: newEvent.id,
        organization_id: orgId,
        team_member_id: a.team_member_id,
        event_role: a.event_role,
        notes: a.notes,
      }));

      await supabase.from('event_team_assignments').insert(newAssignments);
    }

    // Clone checklist items (reset completed state)
    const { data: checklistItems } = await supabase
      .from('event_checklist_items')
      .select('template_item_id, title, description, phase, assignee_id, sort_order, category')
      .eq('event_id', id)
      .is('deleted_at', null);

    if (checklistItems && checklistItems.length > 0) {
      const newItems = checklistItems.map(item => ({
        event_id: newEvent.id,
        organization_id: orgId,
        template_item_id: item.template_item_id,
        title: item.title,
        description: item.description,
        phase: item.phase,
        assignee_id: item.assignee_id,
        sort_order: item.sort_order,
        category: item.category,
        // Reset completed state
        completed_at: null,
        completed_by: null,
        due_date: null,
      }));

      await supabase.from('event_checklist_items').insert(newItems);
    }

    // Audit log
    await auditMutation(request, {
      entity_type: 'event',
      entity_id: newEvent.id,
      action: 'create',
      changes: null,
      metadata: { cloned_from: id },
    });

    return NextResponse.json(newEvent, { status: 201 });
  }
);
