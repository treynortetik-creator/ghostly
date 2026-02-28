/**
 * Ghostly - Expense Documents API
 *
 * GET /api/expenses/:id/documents - List documents for an expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withApiHandler({ permission: 'read', resource: 'expenses/[id]/documents' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = await createClient();

    // Verify expense exists and belongs to org
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('id, vendor')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (expenseError || !expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('expense_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      documents: documents || [],
      expense: { id: expense.id, vendor: expense.vendor },
    });
  }
);
