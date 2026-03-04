/**
 * Ghostly - Single Document API
 *
 * Endpoints:
 * GET /api/documents/:id - Get document metadata
 * DELETE /api/documents/:id - Soft-delete a document
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

// ============================================
// GET /api/documents/:id
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */
export const GET = withApiHandler({ permission: 'read', resource: 'documents' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('*, events(name), expenses(vendor)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const { events: eventRel, expenses: expenseRel, ...rest } = doc as any;
    return NextResponse.json({
      ...rest,
      event_name: eventRel?.name || null,
      expense_vendor: expenseRel?.vendor || null,
    });
  }
);

// ============================================
// DELETE /api/documents/:id
// ============================================

export const DELETE = withApiHandler({ permission: 'write', resource: 'documents' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = createClient();

    // Check document exists
    const { data: existing, error: findError } = await supabase
      .from('documents')
      .select('id, filename')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Soft delete
    const { error: updateError } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', orgId);

    if (updateError) {
      throw updateError;
    }

    // Audit log
    await auditMutation(request, {
      entity_type: 'document',
      entity_id: id,
      action: 'delete',
      changes: null,
      metadata: { filename: existing.filename },
    });

    return NextResponse.json({
      message: 'Document deleted successfully',
      id,
    });
  }
);
