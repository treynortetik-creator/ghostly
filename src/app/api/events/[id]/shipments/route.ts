/**
 * Event Shipments API
 *
 * GET  /api/events/:id/shipments - List shipments for an event
 * POST /api/events/:id/shipments - Create a shipment on an event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

const validStatuses = ['pending', 'in_transit', 'delivered', 'returned', 'issue'];

export const GET = withApiHandler({ permission: 'read', resource: 'events/shipments' },
  async (request: NextRequest, context: RouteContext) => {
    const { id: eventId } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supabase = await createClient();

    let query = supabase
      .from('event_shipments')
      .select('*')
      .eq('event_id', eventId)
      .is('deleted_at', null);

    if (status && validStatuses.includes(status)) {
      query = query.eq('status', status);
    }

    const { data: shipments, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      shipments: shipments || [],
      meta: { total: (shipments || []).length },
    });
  }
);

export const POST = withApiHandler({ permission: 'write', resource: 'events/shipments' },
  async (request: NextRequest, context: RouteContext) => {
    const { id: eventId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    // Validate required fields
    if (!body.description || typeof body.description !== 'string' || body.description.trim().length === 0) {
      return NextResponse.json({ error: 'description is required and must be a non-empty string' }, { status: 400 });
    }

    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { data: shipment, error } = await supabase
      .from('event_shipments')
      .insert({
        event_id: eventId,
        description: body.description.trim(),
        carrier: body.carrier?.trim() || null,
        tracking_number: body.tracking_number?.trim() || null,
        tracking_url: body.tracking_url?.trim() || null,
        status: body.status || 'pending',
        ship_date: body.ship_date || null,
        estimated_delivery: body.estimated_delivery || null,
        actual_delivery: body.actual_delivery || null,
        shipped_from: body.shipped_from?.trim() || null,
        shipped_to: body.shipped_to?.trim() || null,
        weight_lbs: body.weight_lbs || null,
        notes: body.notes?.trim() || null,
        created_by: body.created_by?.trim() || 'system',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(shipment, { status: 201 });
  }
);
