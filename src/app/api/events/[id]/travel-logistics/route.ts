/**
 * Event Travel & Logistics API
 *
 * GET  /api/events/:id/travel-logistics - List travel entries for an event
 * POST /api/events/:id/travel-logistics - Create a travel entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { upsertGeneratedTravelBudgetExpensesForEntry } from '@/lib/travel-expense-sync';

type RouteContext = { params: Promise<{ id: string }> };

const validGroundTransportModes = ['rental_car', 'shuttle', 'rideshare', 'taxi', 'public_transit', 'other'];

function parseBudgetValue(value: unknown, fieldName: string): { value: number | null; error: string | null } {
  if (value === undefined) return { value: null, error: null };
  if (value === null || value === '') return { value: 0, error: null };

  const parsed = Number.parseFloat(String(value));
  if (Number.isNaN(parsed) || parsed < 0) {
    return { value: null, error: `${fieldName} must be a non-negative number` };
  }

  return { value: parsed, error: null };
}

function trimOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const GET = withApiHandler({ permission: 'read', resource: 'events/travel-logistics' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const supabase = createClient();

    const { data: eventCheck } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (!eventCheck) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: entries, error } = await supabase
      .from('event_travel_logistics')
      .select('*')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Include assigned event team members to make traveler selection easy in UI
    const { data: assignments } = await supabase
      .from('event_team_assignments')
      .select('team_member_id, event_role')
      .eq('event_id', eventId);

    const memberIds = (assignments || []).map((a) => a.team_member_id);
    let members: Record<string, unknown>[] = [];
    if (memberIds.length > 0) {
      const { data: teamRows } = await supabase
        .from('team_members')
        .select('id, name, email, default_role')
        .in('id', memberIds)
        .is('deleted_at', null);
      members = teamRows || [];
    }

    const assignmentByMemberId = new Map<string, string | null>(
      (assignments || []).map((a) => [a.team_member_id, a.event_role || null])
    );

    const team_members = members.map((m) => {
      const member = m as { id: string; name: string; email: string | null; default_role: string | null };
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        default_role: member.default_role,
        event_role: assignmentByMemberId.get(member.id) ?? null,
      };
    });

    const totals = (entries || []).reduce((acc, row) => {
      acc.lodging_budget += Number(row.lodging_budget || 0);
      acc.airfare_budget += Number(row.airfare_budget || 0);
      acc.ground_transport_budget += Number(row.ground_transport_budget || 0);
      acc.meals_budget += Number(row.meals_budget || 0);
      acc.misc_travel_budget += Number(row.misc_travel_budget || 0);
      return acc;
    }, {
      lodging_budget: 0,
      airfare_budget: 0,
      ground_transport_budget: 0,
      meals_budget: 0,
      misc_travel_budget: 0,
    });

    const total_budget = totals.lodging_budget
      + totals.airfare_budget
      + totals.ground_transport_budget
      + totals.meals_budget
      + totals.misc_travel_budget;

    return NextResponse.json({
      entries: entries || [],
      team_members,
      totals: { ...totals, total_budget },
      meta: { total: (entries || []).length },
    });
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'events/travel-logistics' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const travelerName = trimOrNull(body.traveler_name);
    if (!travelerName) {
      return NextResponse.json({ error: 'traveler_name is required' }, { status: 400 });
    }

    if (body.ground_transport_mode && !validGroundTransportModes.includes(body.ground_transport_mode)) {
      return NextResponse.json(
        { error: `ground_transport_mode must be one of: ${validGroundTransportModes.join(', ')}` },
        { status: 400 }
      );
    }

    const budgetFields = [
      'lodging_budget',
      'airfare_budget',
      'ground_transport_budget',
      'meals_budget',
      'misc_travel_budget',
    ] as const;

    const parsedBudgets: Record<string, number | null> = {};
    for (const field of budgetFields) {
      const parsed = parseBudgetValue(body[field], field);
      if (parsed.error) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      parsedBudgets[field] = parsed.value;
    }

    // Verify event belongs to org
    const { data: event } = await supabase
      .from('events')
      .select('id, date_start')
      .eq('id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (body.team_member_id) {
      const { data: member } = await supabase
        .from('team_members')
        .select('id')
        .eq('id', body.team_member_id)
        .is('deleted_at', null)
        .single();
      if (!member) {
        return NextResponse.json({ error: 'Invalid team_member_id' }, { status: 400 });
      }
    }

    const { data: entry, error } = await supabase
      .from('event_travel_logistics')
      .insert({
        event_id: eventId,
        team_member_id: body.team_member_id || null,
        traveler_name: travelerName,
        traveler_email: trimOrNull(body.traveler_email),
        traveler_role: trimOrNull(body.traveler_role),
        hotel_name: trimOrNull(body.hotel_name),
        hotel_address: trimOrNull(body.hotel_address),
        hotel_check_in: body.hotel_check_in || null,
        hotel_check_out: body.hotel_check_out || null,
        hotel_confirmation_number: trimOrNull(body.hotel_confirmation_number),
        flight_airline: trimOrNull(body.flight_airline),
        flight_number: trimOrNull(body.flight_number),
        flight_departure_airport: trimOrNull(body.flight_departure_airport),
        flight_arrival_airport: trimOrNull(body.flight_arrival_airport),
        flight_departure_at: body.flight_departure_at || null,
        flight_arrival_at: body.flight_arrival_at || null,
        flight_confirmation_number: trimOrNull(body.flight_confirmation_number),
        ground_transport_mode: body.ground_transport_mode || null,
        ground_transport_details: trimOrNull(body.ground_transport_details),
        lodging_budget: parsedBudgets.lodging_budget,
        airfare_budget: parsedBudgets.airfare_budget,
        ground_transport_budget: parsedBudgets.ground_transport_budget,
        meals_budget: parsedBudgets.meals_budget,
        misc_travel_budget: parsedBudgets.misc_travel_budget,
        notes: trimOrNull(body.notes),
        created_by: trimOrNull(body.created_by) || 'system',
      })
      .select()
      .single();

    if (error) throw error;

    await upsertGeneratedTravelBudgetExpensesForEntry(supabase, {
      orgId,
      eventId,
      entry,
      expenseDate: event.date_start || new Date().toISOString().slice(0, 10),
    });

    return NextResponse.json(entry, { status: 201 });
  }
);
