/**
 * The Counting House - Expense Documents API
 *
 * GET /api/expenses/:id/documents - List documents for an expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const denied = requirePermission(request, 'read');
    if (denied) return denied;

    const { id } = await params;
    const supabase = await createClient();

    // Verify expense exists
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('id, vendor')
      .eq('id', id)
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
  } catch (err) {
    console.error('Expense documents error:', err);
    logError('Failed to fetch expense documents', { error: err as Error, source: 'api/expenses/[id]/documents', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to fetch expense documents' },
      { status: 500 }
    );
  }
}
