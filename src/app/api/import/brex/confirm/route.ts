/**
 * The Counting House - Brex Import Confirmation API
 *
 * POST /api/import/brex/confirm
 * Confirm and create expenses from reviewed Brex transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ExpenseSource } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from '@/lib/api-helpers';
import { logAudit, getActor } from '@/lib/audit';

// ============================================
// TYPES
// ============================================

interface TransactionToImport {
  id: string;
  date: string;
  amount: number;
  vendor: string;
  memo: string | null;
  assignmentId: string;
  assignmentType: 'event' | 'category';
  status: 'accepted' | 'replace';
  replaceExpenseId?: string;
}

interface ImportResult {
  success: boolean;
  expenseId?: string;
  error?: string;
  transactionId: string;
  action: 'created' | 'replaced' | 'skipped' | 'error';
}

// ============================================
// API HANDLER
// ============================================

export const POST = withApiHandler({ permission: 'write', resource: 'import/brex/confirm' },
  async (request: NextRequest) => {
    const supabase = await createClient();
    const body = await request.json();
    const { transactions } = body as { transactions: TransactionToImport[] };

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Invalid request: transactions array required' },
        { status: 400 }
      );
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'No transactions to import' },
        { status: 400 }
      );
    }

    // Validate all transactions before processing
    const validationErrors: string[] = [];

    // Collect all referenced event and category IDs for batch validation
    const referencedEventIds = new Set<string>();
    const referencedCategoryIds = new Set<string>();

    for (const txn of transactions) {
      if (!txn.id || !txn.date || txn.amount === undefined || !txn.vendor) {
        validationErrors.push(`Transaction ${txn.id || 'unknown'}: Missing required fields`);
        continue;
      }

      if (!txn.assignmentId || !txn.assignmentType) {
        validationErrors.push(`Transaction ${txn.id}: No assignment specified`);
        continue;
      }

      if (txn.assignmentType === 'event') {
        referencedEventIds.add(txn.assignmentId);
      } else if (txn.assignmentType === 'category') {
        referencedCategoryIds.add(txn.assignmentId);
      }

      if (txn.status === 'replace' && !txn.replaceExpenseId) {
        validationErrors.push(`Transaction ${txn.id}: Replace action requires replaceExpenseId`);
      }
    }

    // Batch fetch all referenced events and categories (2 queries instead of N)
    const [{ data: validEvents }, { data: validCategories }] = await Promise.all([
      referencedEventIds.size > 0
        ? supabase.from('events').select('id').in('id', [...referencedEventIds]).is('deleted_at', null)
        : Promise.resolve({ data: [] as { id: string }[] }),
      referencedCategoryIds.size > 0
        ? supabase.from('budget_categories').select('id').in('id', [...referencedCategoryIds]).is('deleted_at', null)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);

    const validEventIdSet = new Set((validEvents ?? []).map(e => e.id));
    const validCategoryIdSet = new Set((validCategories ?? []).map(c => c.id));

    // Check each transaction's assignment against the batch results
    for (const txn of transactions) {
      if (!txn.assignmentId || !txn.assignmentType) continue;

      if (txn.assignmentType === 'event' && !validEventIdSet.has(txn.assignmentId)) {
        validationErrors.push(`Transaction ${txn.id}: Event ${txn.assignmentId} not found`);
      } else if (txn.assignmentType === 'category' && !validCategoryIdSet.has(txn.assignmentId)) {
        validationErrors.push(`Transaction ${txn.id}: Category ${txn.assignmentId} not found`);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // Process transactions in batch
    const results: ImportResult[] = [];
    const createdExpenses: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    // Batch soft-delete replacements
    const replaceIds = transactions
      .filter(txn => txn.status === 'replace' && txn.replaceExpenseId)
      .map(txn => txn.replaceExpenseId!);

    if (replaceIds.length > 0) {
      await supabase
        .from('expenses')
        .update({ deleted_at: now })
        .in('id', replaceIds);
    }

    // Build all insert rows
    const insertRows = transactions.map(txn => {
      const isEvent = txn.assignmentType === 'event';
      return {
        event_id: isEvent ? txn.assignmentId : null,
        category_id: !isEvent ? txn.assignmentId : null,
        amount: txn.amount,
        expense_date: txn.date,
        vendor: txn.vendor,
        memo: txn.memo,
        source_type: 'brex' as ExpenseSource,
        source_reference: txn.id,
        is_duplicate: false,
      };
    });

    // Batch insert all expenses
    const { data: newExpenses, error: insertError } = await supabase
      .from('expenses')
      .insert(insertRows)
      .select('*, events(name), budget_categories(name)');

    if (insertError || !newExpenses) {
      // If batch insert fails entirely, mark all as error
      for (const txn of transactions) {
        results.push({
          success: false,
          error: insertError?.message || 'Insert failed',
          transactionId: txn.id,
          action: 'error',
        });
      }
    } else {
      // Match results back to transactions by source_reference
      const expenseByRef = new Map<string, typeof newExpenses[number]>();
      for (const exp of newExpenses) {
        if (exp.source_reference) {
          expenseByRef.set(exp.source_reference, exp);
        }
      }

      for (const txn of transactions) {
        const newExpense = expenseByRef.get(txn.id);
        if (newExpense) {
          const { events: eventRel, budget_categories: catRel, ...rest } = newExpense as any;
          const isEvent = txn.assignmentType === 'event';
          createdExpenses.push({
            ...rest,
            event_name: eventRel?.name || null,
            category_name: catRel?.name || null,
            target_type: isEvent ? 'event' : 'category',
            target_name: eventRel?.name || catRel?.name || 'Unknown',
          });

          results.push({
            success: true,
            expenseId: newExpense.id,
            transactionId: txn.id,
            action: txn.status === 'replace' ? 'replaced' : 'created',
          });
        } else {
          results.push({
            success: false,
            error: 'Expense not found after insert',
            transactionId: txn.id,
            action: 'error',
          });
        }
      }
    }

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      for (const result of results) {
        if (result.success && result.expenseId) {
          logAudit({
            entity_type: 'expense',
            entity_id: result.expenseId,
            action: 'create',
            changes: null,
            actor,
            actor_type,
            metadata: { source: 'brex_import', action: result.action },
          });
        }
      }
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    // Calculate summary
    const summary = {
      total: results.length,
      created: results.filter(r => r.action === 'created').length,
      replaced: results.filter(r => r.action === 'replaced').length,
      errors: results.filter(r => r.action === 'error').length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
    };

    return NextResponse.json({
      success: summary.errors === 0,
      results,
      summary,
      expenses: createdExpenses,
    });
  }
);
