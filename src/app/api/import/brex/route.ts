/**
 * The Counting House - Brex CSV Import API
 *
 * POST /api/import/brex
 * Upload and parse Brex CSV file, get AI suggestions for categorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-logger';
import {
  categorizeTransactions,
  type AssignmentTarget,
  type TransactionForCategorization,
} from '@/lib/openrouter';
import { createClient } from '@/lib/supabase/server';

// ============================================
// TYPES
// ============================================

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
    const memo = memoIndex >= 0 ? values[memoIndex]?.trim() || null : null;
    const expenseStatus = expenseStatusIndex >= 0
      ? values[expenseStatusIndex]?.trim() || ''
      : '';
    const paymentStatus = paymentStatusIndex >= 0
      ? values[paymentStatusIndex]?.trim() || ''
      : '';

    transactions.push({
      id: `brex-${Date.now()}-${i}`,
      date: parsedDate,
      amount,
      originalAmount,
      originalCurrency,
      vendor,
      memo,
      expenseStatus,
      paymentStatus,
    });
  }

  return transactions;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}

// ============================================
// DUPLICATE DETECTION
// ============================================

/**
 * Check for duplicate expenses based on amount, date, and vendor
 */
function findDuplicate(
  transaction: ParsedBrexTransaction,
  existingExpenses: Array<{
    id: string;
    amount: number;
    expense_date: string;
    vendor: string | null;
  }>
): DuplicateInfo | undefined {
  const duplicate = existingExpenses.find(exp => {
    // Match amount (within 0.01 for floating point comparison)
    const amountMatch = Math.abs(exp.amount - transaction.amount) < 0.01;

    // Match date
    const dateMatch = exp.expense_date === transaction.date;

    // Match vendor (case-insensitive partial match)
    const vendorMatch = exp.vendor &&
      (exp.vendor.toLowerCase().includes(transaction.vendor.toLowerCase()) ||
        transaction.vendor.toLowerCase().includes(exp.vendor.toLowerCase()));

    return amountMatch && dateMatch && vendorMatch;
  });

  if (duplicate) {
    return {
      id: duplicate.id,
      date: duplicate.expense_date,
      vendor: duplicate.vendor || 'Unknown',
      amount: duplicate.amount,
    };
  }

  return undefined;
}

// ============================================
// API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const skipAI = formData.get('skipAI') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
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
      supabase.from('expenses').select('id, amount, expense_date, vendor').is('deleted_at', null),
      supabase.from('events').select('id, name, event_type, quarter').is('deleted_at', null),
      supabase.from('budget_categories').select('id, name, description').is('deleted_at', null),
    ]);

    // Build assignment targets
    const targets: AssignmentTarget[] = [
      ...(events || []).map(e => ({
        id: e.id,
        name: e.name,
        type: 'event' as const,
        eventType: e.event_type,
        quarter: e.quarter || undefined,
      })),
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
      const duplicate = findDuplicate(txn, existingExpenses || []);
      if (duplicate) {
        txn.isDuplicate = true;
        txn.duplicateOf = duplicate;
      }
    }

    // Get AI suggestions if not skipped
    let aiResults: Map<string, { targetId: string | null; targetType: 'event' | 'category' | null; confidence: number }> = new Map();

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
  } catch (err) {
    console.error('Brex import error:', err);
    logError('Brex import failed', { error: err as Error, source: 'import/brex' });
    return NextResponse.json(
      { error: 'Failed to process import' },
      { status: 500 }
    );
  }
}
