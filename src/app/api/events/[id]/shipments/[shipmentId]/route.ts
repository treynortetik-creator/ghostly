/**
 * Event Shipment by ID
 *
 * GET    /api/events/:id/shipments/:shipmentId - Get single shipment
 * PUT    /api/events/:id/shipments/:shipmentId - Update a shipment
 * DELETE /api/events/:id/shipments/:shipmentId - Soft delete a shipment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

type RouteContext = { params: Promise<{ id: string; shipmentId: string }> };

const validStatuses = ['pending', 'in_transit', 'delivered', 'returned', 'issue'];

export async function GET(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const { id: eventId, shipmentId } = await context.params;
    const supabase = await createClient();

    const { data: shipment, error } = await supabase
      .from('event_shipments')
      .select('*')
      .eq('id', shipmentId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .single();

    if (error || !shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json(shipment);
  } catch (err) {
    console.error('Get shipment error:', err);
    logError('Failed to fetch shipment', { error: err as Error, source: 'api/events/[id]/shipments/[shipmentId]', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch shipment' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const { id: eventId, shipmentId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};

    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.trim().length === 0) {
        return NextResponse.json({ error: 'description must be a non-empty string' }, { status: 400 });
      }
      updates.description = body.description.trim();
    }

    if (body.carrier !== undefined) updates.carrier = body.carrier?.trim() || null;
    if (body.tracking_number !== undefined) updates.tracking_number = body.tracking_number?.trim() || null;
    if (body.tracking_url !== undefined) updates.tracking_url = body.tracking_url?.trim() || null;
    
    if (body.status !== undefined) {
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.ship_date !== undefined) updates.ship_date = body.ship_date || null;
    if (body.estimated_delivery !== undefined) updates.estimated_delivery = body.estimated_delivery || null;
    if (body.actual_delivery !== undefined) updates.actual_delivery = body.actual_delivery || null;
    if (body.shipped_from !== undefined) updates.shipped_from = body.shipped_from?.trim() || null;
    if (body.shipped_to !== undefined) updates.shipped_to = body.shipped_to?.trim() || null;
    if (body.weight_lbs !== undefined) updates.weight_lbs = body.weight_lbs || null;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: shipment, error } = await supabase
      .from('event_shipments')
      .update(updates)
      .eq('id', shipmentId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json(shipment);
  } catch (err) {
    console.error('Update shipment error:', err);
    logError('Failed to update shipment', { error: err as Error, source: 'api/events/[id]/shipments/[shipmentId]', context: { method: 'PUT' } });
    return NextResponse.json({ error: 'Failed to update shipment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const { id: eventId, shipmentId } = await context.params;
    const supabase = await createClient();

    const { data: shipment, error } = await supabase
      .from('event_shipments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', shipmentId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !shipment) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Shipment deleted', id: shipmentId });
  } catch (err) {
    console.error('Delete shipment error:', err);
    logError('Failed to delete shipment', { error: err as Error, source: 'api/events/[id]/shipments/[shipmentId]', context: { method: 'DELETE' } });
    return NextResponse.json({ error: 'Failed to delete shipment' }, { status: 500 });
  }
}