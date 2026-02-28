/**
 * Ghostly - Brex CSV Import API
 *
 * POST /api/import/brex
 * Upload and parse Brex CSV file, get AI suggestions for categorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants';
import {
  categorizeTransactions,
  type AssignmentTarget,
  type TransactionForCategorization,
} from '@/lib/openrouter';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { parseCSVLine, findDuplicate, type DuplicateCandidate } from '@/lib/business-logic';

// ============================================
// TYPES
// ============================================

const MAX_VENDOR_LENGTH = 200;
const MAX_MEMO_LENGTH = 1000;

interface ParsedBrexTransaction {
  id: string;
  date: string;
  amount: number;
  originalAmount: number;
  originalCurrency: string;
  vendor: string;
  memo: string | null;
  expenseStatus: string;
  paymentStatus: string;
}

interface DuplicateInfo {
  id: string;
  date: string;
  vendor: string;
  amount: number;
}

interface TransactionWithSuggestion extends ParsedBrexTransaction {
  suggestedAssignment: {
    id: string;
    name: string;
    type: 'event' | 'category';
    eventType?: string;
    quarter?: string;
  } | null;
  aiConfidence: number | null;
  isDuplicate: boolean;
  duplicateOf?: DuplicateInfo;
}

// ============================================
// CSV PARSING
// ============================================

/**
 * Parse Brex CSV content into transactions
 *
 * Expected format:
 * Transaction date,Amount,Original amount,Original currency,Merchant,Memo,Expense status,Payment status
 */
function parseBrexCSV(csvContent: string): ParsedBrexTransaction[] {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row');
  }

  // Parse header
  const header = parseCSVLine(lines[0]);
  const headerLower = header.map(h => h.toLowerCase().trim());

  // Find column indexes
  const dateIndex = headerLower.findIndex(h =>
    h.includes('transaction date') || h === 'date'
  );
  const amountIndex = headerLower.findIndex(h => h === 'amount');
  const originalAmountIndex = headerLower.findIndex(h =>
    h.includes('original amount')
  );
  const originalCurrencyIndex = headerLower.findIndex(h =>
    h.includes('original currency') || h.includes('currency')
  );
  const merchantIndex = headerLower.findIndex(h =>
    h.includes('merchant') || h.includes('vendor')
  );
  const memoIndex = headerLower.findIndex(h =>
    h.includes('memo') || h.includes('description') || h.includes('note')
  );
  const expenseStatusIndex = headerLower.findIndex(h =>
    h.includes('expense status')
  );
  const paymentStatusIndex = headerLower.findIndex(h =>
    h.includes('payment status')
  );

  // Validate required columns
  if (dateIndex === -1) {
    throw new Error('CSV must have a "Transaction date" column');
  }
  if (amountIndex === -1) {
    throw new Error('CSV must have an "Amount" column');
  }
  if (merchantIndex === -1) {
    throw new Error('CSV must have a "Merchant" column');
  }

  // Parse data rows
  const transactions: ParsedBrexTransaction[] = [];
  let counter = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length < Math.max(dateIndex, amountIndex, merchantIndex) + 1) {
      continue; // Skip malformed rows
    }

    const rawDate = values[dateIndex]?.trim();
    const rawAmount = values[amountIndex]?.trim();
    const vendor = values[merchantIndex]?.trim();

    if (!rawDate || !rawAmount || !vendor) {
      continue; // Skip rows with missing required fields
    }

    // Parse date (MM/DD/YYYY or YYYY-MM-DD)
    let parsedDate: string;
    if (rawDate.includes('/')) {
      const [month, day, year] = rawDate.split('/');
      parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      parsedDate = rawDate;
    }

    // Parse amount
    const amount = parseFloat(rawAmount.replace(/[$,]/g, ''));
    if (isNaN(amount)) {
      continue; // Skip rows with invalid amounts
    }

    // Parse optional fields
    const originalAmount = originalAmountIndex >= 0
      ? parseFloat(values[originalAmountIndex]?.replace(/[$,]/g, '') || '') || amount
      : amount;
    const originalCurrency = originalCurrencyIndex >= 0
      ? values[originalCurrencyIndex]?.trim() || 'USD'
      : 'USD';
    const rawMemo = memoIndex >= 0 ? values[memoIndex]?.trim() || null : null;
    const memo = rawMemo ? rawMemo.substring(0, MAX_MEMO_LENGTH) : null;
    const expenseStatus = expenseStatusIndex >= 0
      ? values[expenseStatusIndex]?.trim() || ''
      : '';
    const paymentStatus = paymentStatusIndex >= 0
      ? values[paymentStatusIndex]?.trim() || ''
      : '';

    transactions.push({
      id: `brex-${Date.now()}-${counter++}`,
      date: parsedDate,
      amount,
      originalAmount,
      originalCurrency,
      vendor: vendor.substring(0, MAX_VENDOR_LENGTH),
      memo,
      expenseStatus,
      paymentStatus,
    });
  }

  return transactions;
}

// parseCSVLine and findDuplicate imported from @/lib/business-logic

// ============================================
// API HANDLER
// ============================================

export const POST = withApiHandler({ permission: 'write', resource: 'import/brex' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const skipAI = formData.get('skipAI') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV file' },
        { status: 400 }
      );
    }

    // Read file content
    const csvContent = await file.text();

    // Parse CSV
    let transactions: ParsedBrexTransaction[];
    try {
      transactions = parseBrexCSV(csvContent);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to parse CSV' },
        { status: 400 }
      );
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'No valid transactions found in CSV file' },
        { status: 400 }
      );
    }

    // Get existing data from Supabase
    const supabase = await createClient();

    const [
      { data: existingExpenses },
      { data: events },
      { data: categories },
    ] = await Promise.all([
      supabase.from('expenses').select('id, amount, expense_date, vendor').eq('organization_id', orgId).is('deleted_at', null),
      supabase.from('events').select('id, name, event_type_id, quarter, event_types(name)').eq('organization_id', orgId).is('deleted_at', null),
      supabase.from('budget_categories').select('id, name, description').eq('organization_id', orgId).is('deleted_at', null),
    ]);

    // Build assignment targets
    const targets: AssignmentTarget[] = [
      ...(events || []).map(e => {
        // Handle joined event_types - can be object or array depending on Supabase version
        // Use unknown cast first to handle type system before migration is applied
        const eventTypeData = e.event_types as unknown;
        let eventTypeName: string | undefined;
        if (Array.isArray(eventTypeData)) {
          eventTypeName = (eventTypeData[0] as { name?: string } | undefined)?.name;
        } else if (eventTypeData && typeof eventTypeData === 'object') {
          eventTypeName = (eventTypeData as { name?: string }).name;
        }
        return {
          id: e.id,
          name: e.name,
          type: 'event' as const,
          eventType: eventTypeName || undefined,
          quarter: e.quarter || undefined,
        };
      }),
      ...(categories || []).map(c => ({
        id: c.id,
        name: c.name,
        type: 'category' as const,
        description: c.description || undefined,
      })),
    ];

    // Check for duplicates
    const transactionsWithDuplicates = transactions.map(txn => ({
      ...txn,
      isDuplicate: false as boolean,
      duplicateOf: undefined as DuplicateInfo | undefined,
    }));

    for (const txn of transactionsWithDuplicates) {
      const dup = findDuplicate(
        { amount: txn.amount, date: txn.date, vendor: txn.vendor },
        (existingExpenses || []) as DuplicateCandidate[]
      );
      if (dup) {
        txn.isDuplicate = true;
        txn.duplicateOf = {
          id: dup.id,
          date: dup.expense_date,
          vendor: dup.vendor || 'Unknown',
          amount: dup.amount,
        };
      }
    }

    // Get AI suggestions if not skipped
    const aiResults: Map<string, { targetId: string | null; targetType: 'event' | 'category' | null; confidence: number }> = new Map();

    if (!skipAI && process.env.OPENROUTER_API_KEY) {
      try {
        const txnsForAI: TransactionForCategorization[] = transactions.map(t => ({
          id: t.id,
          vendor: t.vendor,
          memo: t.memo,
          amount: t.amount,
          date: t.date,
        }));

        const categorization = await categorizeTransactions(txnsForAI, targets);

        for (const result of categorization.results) {
          aiResults.set(result.transactionId, {
            targetId: result.suggestedTargetId,
            targetType: result.suggestedTargetType,
            confidence: result.confidence,
          });
        }
      } catch (error) {
        console.error('AI categorization failed:', error);
        // Continue without AI suggestions
      }
    }

    // Build final response
    const results: TransactionWithSuggestion[] = transactionsWithDuplicates.map(txn => {
      const aiSuggestion = aiResults.get(txn.id);
      let suggestedAssignment: TransactionWithSuggestion['suggestedAssignment'] = null;

      if (aiSuggestion?.targetId && aiSuggestion?.targetType) {
        const target = targets.find(t => t.id === aiSuggestion.targetId);
        if (target) {
          suggestedAssignment = {
            id: target.id,
            name: target.name,
            type: target.type,
            eventType: target.eventType,
            quarter: target.quarter,
          };
        }
      }

      return {
        ...txn,
        suggestedAssignment,
        aiConfidence: aiSuggestion?.confidence ?? null,
      };
    });

    return NextResponse.json({
      transactions: results,
      meta: {
        total: results.length,
        duplicates: results.filter(t => t.isDuplicate).length,
        withSuggestions: results.filter(t => t.suggestedAssignment).length,
        fileName: file.name,
      },
      assignmentOptions: targets.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        eventType: t.eventType,
        quarter: t.quarter,
      })),
    });
  }
);
