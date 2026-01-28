/**
 * The Counting House - Brex Import Confirmation API
 *
 * POST /api/import/brex/confirm
 * Confirm and create expenses from reviewed Brex transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ExpenseSource } from '@/types/database';
import { getEventById } from '@/lib/mock-data/events';
import { getCategoryById } from '@/lib/mock-data/categories';
import { type ExpenseWithRelations, allExpenses } from '@/lib/mock-data/expenses';

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

export async function POST(request: NextRequest) {
  try {
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
        const event = getEventById(txn.assignmentId);
        if (!event) {
          validationErrors.push(`Transaction ${txn.id}: Event ${txn.assignmentId} not found`);
        }
      } else if (txn.assignmentType === 'category') {
        const category = getCategoryById(txn.assignmentId);
        if (!category) {
          validationErrors.push(`Transaction ${txn.id}: Category ${txn.assignmentId} not found`);
        }
      }

      if (txn.status === 'replace' && !txn.replaceExpenseId) {
        validationErrors.push(`Transaction ${txn.id}: Replace action requires replaceExpenseId`);
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

    // Process transactions
    const results: ImportResult[] = [];
    const createdExpenses: ExpenseWithRelations[] = [];
    const now = new Date().toISOString();

    for (const txn of transactions) {
      try {
        const isEvent = txn.assignmentType === 'event';
        const event = isEvent ? getEventById(txn.assignmentId) : null;
        const category = !isEvent ? getCategoryById(txn.assignmentId) : null;

        // Handle replace action
        if (txn.status === 'replace' && txn.replaceExpenseId) {
          // In a real implementation, we would:
          // 1. Soft-delete the existing expense
          // 2. Create the new expense
          // For mock purposes, we'll just mark as replaced

          // Find and mark old expense as deleted (in real Supabase, use soft delete)
          const existingIndex = allExpenses.findIndex(e => e.id === txn.replaceExpenseId);
          if (existingIndex >= 0) {
            allExpenses[existingIndex].deleted_at = now;
          }
        }

        // Create new expense
        const newExpense: ExpenseWithRelations = {
          id: `exp-brex-${Date.now()}-${txn.id}`,
          event_id: isEvent ? txn.assignmentId : null,
          category_id: !isEvent ? txn.assignmentId : null,
          amount: txn.amount,
          expense_date: txn.date,
          vendor: txn.vendor,
          memo: txn.memo,
          source_type: 'brex' as ExpenseSource,
          source_reference: txn.id,
          is_duplicate: false,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          event_name: event?.name || null,
          category_name: category?.name || null,
          target_type: isEvent ? 'event' : 'category',
          target_name: event?.name || category?.name || 'Unknown',
        };

        // In a real implementation, we would insert into Supabase
        // For mock purposes, add to the in-memory array
        createdExpenses.push(newExpense);
        // allExpenses.push(newExpense); // Uncomment to persist in mock

        results.push({
          success: true,
          expenseId: newExpense.id,
          transactionId: txn.id,
          action: txn.status === 'replace' ? 'replaced' : 'created',
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          transactionId: txn.id,
          action: 'error',
        });
      }
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
  } catch (error) {
    console.error('Brex import confirm error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm import' },
      { status: 500 }
    );
  }
}
