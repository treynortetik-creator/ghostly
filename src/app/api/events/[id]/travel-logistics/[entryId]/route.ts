/**
 * Event Travel & Logistics Entry API
 *
 * GET    /api/events/:id/travel-logistics/:entryId - Get single travel entry
 * PUT    /api/events/:id/travel-logistics/:entryId - Update travel entry
 * DELETE /api/events/:id/travel-logistics/:entryId - Soft delete travel entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import {
  softDeleteGeneratedTravelBudgetExpenses,
  upsertGeneratedTravelBudgetExpensesForEntry,
} from '@/lib/travel-expense-sync';

type RouteContext = { params: Promise<{ id: string; entryId: string }> };

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

async function ensureEventInOrg(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, orgId: string): Promise<boolean> {
  const { data: event } = await supabase
    .from('events')
    .select('id, date_start')
    .eq('id', eventId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single();

  return !!event;
}

export const GET = withApiHandler({ permission: 'read', resource: 'events/travel-logistics' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId, entryId } = await context.params;
    const supabase = await createClient();

    const eventExists = await ensureEventInOrg(supabase, eventId, orgId);
    if (!eventExists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: entry, error } = await supabase
      .from('event_travel_logistics')
      .select('*')
      .eq('id', entryId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: 'Travel entry not found' }, { status: 404 });
    }

    return NextResponse.json(entry);
  }
);

export const PUT = withApiHandler({ permission: 'write', resource: 'events/travel-logistics' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId, entryId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

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

    const updates: Record<string, unknown> = {};

    if (body.traveler_name !== undefined) {
      const travelerName = trimOrNull(body.traveler_name);
      if (!travelerName) {
        return NextResponse.json({ error: 'traveler_name must be a non-empty string' }, { status: 400 });
      }
      updates.traveler_name = travelerName;
    }

    if (body.team_member_id !== undefined) {
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
        updates.team_member_id = body.team_member_id;
      } else {
        updates.team_member_id = null;
      }
    }

    if (body.ground_transport_mode !== undefined) {
      if (body.ground_transport_mode && !validGroundTransportModes.includes(body.ground_transport_mode)) {
        return NextResponse.json(
          { error: `ground_transport_mode must be one of: ${validGroundTransportModes.join(', ')}` },
          { status: 400 }
        );
      }
      updates.ground_transport_mode = body.ground_transport_mode || null;
    }

    if (body.traveler_email !== undefined) updates.traveler_email = trimOrNull(body.traveler_email);
    if (body.traveler_role !== undefined) updates.traveler_role = trimOrNull(body.traveler_role);
    if (body.hotel_name !== undefined) updates.hotel_name = trimOrNull(body.hotel_name);
    if (body.hotel_address !== undefined) updates.hotel_address = trimOrNull(body.hotel_address);
    if (body.hotel_check_in !== undefined) updates.hotel_check_in = body.hotel_check_in || null;
    if (body.hotel_check_out !== undefined) updates.hotel_check_out = body.hotel_check_out || null;
    if (body.hotel_confirmation_number !== undefined) updates.hotel_confirmation_number = trimOrNull(body.hotel_confirmation_number);
    if (body.flight_airline !== undefined) updates.flight_airline = trimOrNull(body.flight_airline);
    if (body.flight_number !== undefined) updates.flight_number = trimOrNull(body.flight_number);
    if (body.flight_departure_airport !== undefined) updates.flight_departure_airport = trimOrNull(body.flight_departure_airport);
    if (body.flight_arrival_airport !== undefined) updates.flight_arrival_airport = trimOrNull(body.flight_arrival_airport);
    if (body.flight_departure_at !== undefined) updates.flight_departure_at = body.flight_departure_at || null;
    if (body.flight_arrival_at !== undefined) updates.flight_arrival_at = body.flight_arrival_at || null;
    if (body.flight_confirmation_number !== undefined) updates.flight_confirmation_number = trimOrNull(body.flight_confirmation_number);
    if (body.ground_transport_details !== undefined) updates.ground_transport_details = trimOrNull(body.ground_transport_details);
    if (body.notes !== undefined) updates.notes = trimOrNull(body.notes);

    const budgetFields = [
      'lodging_budget',
      'airfare_budget',
      'ground_transport_budget',
      'meals_budget',
      'misc_travel_budget',
    ] as const;

    for (const field of budgetFields) {
      const parsed = parseBudgetValue(body[field], field);
      if (parsed.error) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      if (body[field] !== undefined) {
        updates[field] = parsed.value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: entry, error } = await supabase
      .from('event_travel_logistics')
      .update(updates)
      .eq('id', entryId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: 'Travel entry not found' }, { status: 404 });
    }

    await upsertGeneratedTravelBudgetExpensesForEntry(supabase, {
      orgId,
      eventId,
      entry,
      expenseDate: event.date_start || new Date().toISOString().slice(0, 10),
    });

    return NextResponse.json(entry);
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'events/travel-logistics' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId, entryId } = await context.params;
    const supabase = await createClient();

    const eventExists = await ensureEventInOrg(supabase, eventId, orgId);
    if (!eventExists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: entry, error } = await supabase
      .from('event_travel_logistics')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', entryId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select('id')
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: 'Travel entry not found' }, { status: 404 });
    }

    await softDeleteGeneratedTravelBudgetExpenses(supabase, orgId, eventId, entryId);

    return NextResponse.json({ message: 'Travel entry deleted', id: entryId });
  }
);
