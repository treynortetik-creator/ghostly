/**
 * Ghostly - Brex Import Confirmation API
 *
 * POST /api/import/brex/confirm
 * Confirm and create expenses from reviewed Brex transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Database, ExpenseSource } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { logAudit, getActor } from '@/lib/audit';
import {
  isExpenseBudgetBucket,
  isTravelCostType,
  resolveTravelEntryIdForExpense,
  syncTravelBudgetsForPairs,
} from '@/lib/travel-expense-sync';
import { processBudgetTriggerForEvent } from '@/lib/agent/worker';

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
  budgetBucket?: 'event' | 'travel' | 'category';
  travelLogisticsEntryId?: string;
  travelCostType?: 'lodging' | 'airfare' | 'ground_transport' | 'meals' | 'misc';
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

type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
type ExpenseInsertWithOrg = ExpenseInsert & { organization_id: string };

type ImportedExpenseRow = Record<string, unknown> & {
  events: { name: string } | { name: string }[] | null;
  budget_categories: { name: string } | { name: string }[] | null;
};

function relationName(value: { name: string } | { name: string }[] | null): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name || null;
  return value.name || null;
}

// ============================================
// API HANDLER
// ============================================

const MAX_TRANSACTIONS_PER_REQUEST = 100;

export const POST = withApiHandler({ permission: 'write', resource: 'import/brex/confirm' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();
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

    if (transactions.length > MAX_TRANSACTIONS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_TRANSACTIONS_PER_REQUEST} transactions per request` },
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

      if (txn.budgetBucket !== undefined && !isExpenseBudgetBucket(txn.budgetBucket)) {
        validationErrors.push(`Transaction ${txn.id}: Invalid budgetBucket`);
      }

      const budgetBucket = txn.assignmentType === 'category'
        ? 'category'
        : (txn.budgetBucket || 'event');

      if (txn.assignmentType === 'event' && txn.budgetBucket === 'category') {
        validationErrors.push(`Transaction ${txn.id}: Event assignments cannot use budgetBucket "category"`);
      }

      if (txn.assignmentType === 'category' && txn.budgetBucket && txn.budgetBucket !== 'category') {
        validationErrors.push(`Transaction ${txn.id}: Category assignments must use budgetBucket "category"`);
      }

      if (budgetBucket === 'travel') {
        const travelCostType = txn.travelCostType || 'misc';
        if (!isTravelCostType(travelCostType)) {
          validationErrors.push(`Transaction ${txn.id}: Invalid travelCostType`);
        }
      } else if (txn.travelLogisticsEntryId || txn.travelCostType) {
        validationErrors.push(`Transaction ${txn.id}: travelLogisticsEntryId/travelCostType require budgetBucket "travel"`);
      }
    }

    // Batch fetch all referenced events and categories (2 queries instead of N, scoped to org)
    const [{ data: validEvents }, { data: validCategories }] = await Promise.all([
      referencedEventIds.size > 0
        ? supabase.from('events').select('id').in('id', [...referencedEventIds]).eq('organization_id', orgId).is('deleted_at', null)
        : Promise.resolve({ data: [] as { id: string }[] }),
      referencedCategoryIds.size > 0
        ? supabase.from('budget_categories').select('id').in('id', [...referencedCategoryIds]).eq('organization_id', orgId).is('deleted_at', null)
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

    // Batch soft-delete replacements (with rollback tracking)
    const replaceIds = transactions
      .filter(txn => txn.status === 'replace' && txn.replaceExpenseId)
      .map(txn => txn.replaceExpenseId!);

    let softDeletedIds: string[] = [];

    if (replaceIds.length > 0) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('expenses')
        .update({ deleted_at: now })
        .in('id', replaceIds)
        .select('id');

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to soft-delete replaced expenses', details: deleteError.message },
          { status: 500 }
        );
      }

      softDeletedIds = (deletedRows || []).map((r: { id: string }) => r.id);
    }

    // Build all insert rows
    const insertRows: ExpenseInsertWithOrg[] = [];
    const travelSyncPairs: Array<{ entryId?: string | null; costType?: string | null }> = [];

    for (const txn of transactions) {
      const isEvent = txn.assignmentType === 'event';
      const budgetBucket = isEvent ? (txn.budgetBucket || 'event') : 'category';
      let travelLogisticsEntryId: string | null = null;
      let travelCostType: string | null = null;

      if (budgetBucket === 'travel') {
        travelCostType = txn.travelCostType || 'misc';
        try {
          travelLogisticsEntryId = await resolveTravelEntryIdForExpense(
            supabase,
            orgId,
            txn.assignmentId,
            txn.travelLogisticsEntryId || null
          );
        } catch (error) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: [`Transaction ${txn.id}: ${error instanceof Error ? error.message : 'Invalid travel logistics assignment'}`],
            },
            { status: 400 }
          );
        }
        travelSyncPairs.push({ entryId: travelLogisticsEntryId, costType: travelCostType });
      }

      insertRows.push({
        organization_id: orgId,
        event_id: isEvent ? txn.assignmentId : null,
        category_id: !isEvent ? txn.assignmentId : null,
        amount: txn.amount,
        expense_date: txn.date,
        vendor: txn.vendor,
        memo: txn.memo,
        source_type: 'brex' as ExpenseSource,
        source_reference: txn.id,
        budget_bucket: budgetBucket,
        travel_logistics_entry_id: travelLogisticsEntryId,
        travel_cost_type: travelCostType,
        is_duplicate: false,
      });
    }

    // Batch insert all expenses
    const { data: newExpenses, error: insertError } = await supabase
      .from('expenses')
      .insert(insertRows as unknown as ExpenseInsert[])
      .select('*, events(name), budget_categories(name)');

    if (insertError || !newExpenses) {
      // Insert failed — rollback the soft-deletes to restore original expenses
      if (softDeletedIds.length > 0) {
        const { error: rollbackError } = await supabase
          .from('expenses')
          .update({ deleted_at: null })
          .in('id', softDeletedIds);

        if (rollbackError) {
          console.error('CRITICAL: Failed to rollback soft-deleted expenses after insert failure:', rollbackError);
        }
      }

      // Mark all as error
      for (const txn of transactions) {
        results.push({
          success: false,
          error: insertError?.message || 'Insert failed',
          transactionId: txn.id,
          action: 'error',
        });
      }
    } else {
      await syncTravelBudgetsForPairs(supabase, travelSyncPairs);
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
          const { events: eventRel, budget_categories: catRel, ...rest } = newExpense as unknown as ImportedExpenseRow;
          const isEvent = txn.assignmentType === 'event';
          createdExpenses.push({
            ...rest,
            event_name: relationName(eventRel),
            category_name: relationName(catRel),
            target_type: isEvent ? 'event' : 'category',
            target_name: relationName(eventRel) || relationName(catRel) || 'Unknown',
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

      const eventIds = new Set(
        (newExpenses || [])
          .map((expense) => expense.event_id)
          .filter((eventId): eventId is string => typeof eventId === 'string' && eventId.length > 0)
      );
      for (const eventId of eventIds) {
        processBudgetTriggerForEvent(orgId, eventId).catch((err) => console.error('Budget trigger failed for event:', eventId, err));
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
