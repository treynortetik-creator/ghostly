/**
 * Event Travel Logistics Brief API
 *
 * GET /api/events/:id/travel-logistics/brief - Compile a human-readable logistics brief
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string | null): string {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const GET = withApiHandler({ permission: 'read', resource: 'events/travel-logistics' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const supabase = createClient();

    const { data: event } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: entries, error } = await supabase
      .from('event_travel_logistics')
      .select('*')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('traveler_name', { ascending: true });

    if (error) throw error;

    const entryList = entries || [];
    const totals = entryList.reduce((acc, row) => {
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

    const totalBudget = totals.lodging_budget
      + totals.airfare_budget
      + totals.ground_transport_budget
      + totals.meals_budget
      + totals.misc_travel_budget;

    if (entryList.length === 0) {
      return NextResponse.json({
        brief: `No travel logistics have been added for ${event.name} yet.`,
        totals: { ...totals, total_budget: totalBudget },
        entry_count: 0,
      });
    }

    const travelerLines = entryList.map((entry) => {
      const person = entry.traveler_role
        ? `${entry.traveler_name} (${entry.traveler_role})`
        : entry.traveler_name;

      const hotel = entry.hotel_name
        ? `${entry.hotel_name} (${formatDate(entry.hotel_check_in)} - ${formatDate(entry.hotel_check_out)})`
        : 'Hotel TBD';

      const flight = entry.flight_airline || entry.flight_number
        ? `${entry.flight_airline || 'Airline TBD'} ${entry.flight_number || ''}`.trim() +
          ` | ${entry.flight_departure_airport || 'TBD'} -> ${entry.flight_arrival_airport || 'TBD'} | Departs ${formatDateTime(entry.flight_departure_at)}`
        : 'Flight TBD';

      const ground = entry.ground_transport_mode
        ? `${entry.ground_transport_mode.replace(/_/g, ' ')}${entry.ground_transport_details ? ` (${entry.ground_transport_details})` : ''}`
        : 'Ground transport TBD';

      const travelerBudget = Number(entry.lodging_budget || 0)
        + Number(entry.airfare_budget || 0)
        + Number(entry.ground_transport_budget || 0)
        + Number(entry.meals_budget || 0)
        + Number(entry.misc_travel_budget || 0);

      return `- ${person}: Hotel ${hotel}; Flight ${flight}; Ground ${ground}; Travel budget ${formatCurrency(travelerBudget)}.`;
    });

    const brief = [
      `Here's your team's travel rundown for ${event.name}:`,
      ...travelerLines,
      '',
      `Budget summary: lodging ${formatCurrency(totals.lodging_budget)}, airfare ${formatCurrency(totals.airfare_budget)}, ground ${formatCurrency(totals.ground_transport_budget)}, meals ${formatCurrency(totals.meals_budget)}, misc ${formatCurrency(totals.misc_travel_budget)}. Total ${formatCurrency(totalBudget)}.`,
    ].join('\n');

    return NextResponse.json({
      brief,
      totals: { ...totals, total_budget: totalBudget },
      entry_count: entryList.length,
    });
  }
);
