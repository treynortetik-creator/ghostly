/**
 * The Counting House - Event Type Detail API
 *
 * Endpoints:
 * GET /api/event-types/[id] - Get single event type
 * PUT /api/event-types/[id] - Update event type
 * DELETE /api/event-types/[id] - Archive event type
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';
import type { AuditEntityType } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

// ============================================
// GET /api/event-types/[id]
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'event-types/[id]' },
  async (_request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: eventType, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !eventType) {
      return NextResponse.json(
        { error: 'Event type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(eventType);
  }
);

// ============================================
// PUT /api/event-types/[id]
// ============================================

export const PUT = withApiHandler({ permission: 'write', resource: 'event-types/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    // Validate name if provided
    if (body.name !== undefined) {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { error: 'Name cannot be empty' },
          { status: 400 }
        );
      }
      if (String(body.name).length > 100) {
        return NextResponse.json(
          { error: 'Name must be 100 characters or fewer' },
          { status: 400 }
        );
      }
    }

    // Validate budget if provided
    if (body.budget_amount !== undefined) {
      const budgetAmount = parseFloat(body.budget_amount);
      if (isNaN(budgetAmount) || budgetAmount < 0) {
        return NextResponse.json(
          { error: 'Budget amount must be zero or positive' },
          { status: 400 }
        );
      }
    }

    // Check event type exists
    const { data: existing } = await supabase
      .from('event_types')
      .select('id, fiscal_year_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Event type not found' },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being changed
    if (body.name && existing.fiscal_year_id) {
      // Escape LIKE wildcards (%, _, \) to prevent pattern injection
      const escapedName = body.name.trim().replace(/[%_\\]/g, '\\$&');
      const { data: duplicate } = await supabase
        .from('event_types')
        .select('id')
        .eq('fiscal_year_id', existing.fiscal_year_id)
        .ilike('name', escapedName)
        .eq('is_archived', false)
        .neq('id', id);

      if (duplicate && duplicate.length > 0) {
        return NextResponse.json(
          { error: 'An event type with this name already exists' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.budget_amount !== undefined) updateData.budget_amount = parseFloat(body.budget_amount) || 0;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;

    const { data: updated, error: updateError } = await supabase
      .from('event_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Audit log (non-blocking)
    await auditMutation(request, {
      entity_type: 'event' as AuditEntityType,
      entity_id: id,
      action: 'update',
      changes: null,
      metadata: { sub_type: 'event_type' },
    });

    return NextResponse.json(updated);
  }
);

// ============================================
// DELETE /api/event-types/[id]
// ============================================

export const DELETE = withApiHandler({ permission: 'write', resource: 'event-types/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const { id } = await context.params;
    const supabase = await createClient();

    // Archive instead of delete (soft delete)
    const { data: archived, error } = await supabase
      .from('event_types')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Event type not found' },
        { status: 404 }
      );
    }

    // Audit log (non-blocking)
    await auditMutation(request, {
      entity_type: 'event' as AuditEntityType,
      entity_id: id,
      action: 'delete',
      changes: null,
      metadata: { sub_type: 'event_type' },
    });

    return NextResponse.json({ message: 'Event type archived', event_type: archived });
  }
);
