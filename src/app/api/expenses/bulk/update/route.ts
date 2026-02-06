/**
 * The Counting House - Bulk Expense Update API
 *
 * Endpoints:
 * PUT /api/expenses/bulk/update - Update multiple expenses in one request
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';
import type { ExpenseSource } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { withIdempotency } from '@/lib/idempotency';
import { logAudit, getActor, computeChanges } from '@/lib/audit';

const MAX_UPDATES_PER_REQUEST = 100;

const UPDATABLE_FIELDS = ['amount', 'vendor', 'memo', 'event_id', 'category_id', 'expense_date'] as const;
const AUDIT_FIELDS = ['amount', 'expense_date', 'vendor', 'memo', 'event_id', 'category_id'];

interface UpdateInput {
  id: unknown;
  amount?: unknown;
  expense_date?: unknown;
  event_id?: unknown;
  category_id?: unknown;
  vendor?: unknown;
  memo?: unknown;
}

interface ItemError {
  index: number;
  errors: string[];
}

/**
 * Validate a single update item synchronously (field-level checks only).
 * Returns an array of error messages, empty if valid.
 */
function validateUpdateItem(item: UpdateInput): string[] {
  const errors: string[] = [];

  // id is required
  if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') {
    errors.push('Missing or invalid required field: id');
  }

  // Must have at least one field to update
  const hasUpdate = UPDATABLE_FIELDS.some(f => (item as unknown as Record<string, unknown>)[f] !== undefined);
  if (!hasUpdate) {
    errors.push('Must include at least one field to update');
  }

  // Validate amount if provided
  if (item.amount !== undefined) {
    const amount = parseFloat(String(item.amount));
    if (isNaN(amount) || amount <= 0) {
      errors.push('Invalid amount. Must be a positive number');
    }
  }

  // Validate vendor length if provided
  if (item.vendor !== undefined && item.vendor !== null && String(item.vendor).length > 200) {
    errors.push('Vendor name must be 200 characters or fewer');
  }

  // Validate memo length if provided
  if (item.memo !== undefined && item.memo !== null && String(item.memo).length > 2000) {
    errors.push('Memo must be 2000 characters or fewer');
  }

  // Validate expense_date format if provided
  if (item.expense_date !== undefined) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(String(item.expense_date))) {
      errors.push('Invalid expense_date format. Use YYYY-MM-DD');
    }
  }

  return errors;
}

// ============================================
// PUT /api/expenses/bulk/update
// ============================================

export const PUT = withIdempotency(async function PUT(request: NextRequest) {
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const body = await request.json();

    // Validate top-level structure
    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { error: 'Request body must contain an "updates" array' },
        { status: 400 }
      );
    }

    if (body.updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array must not be empty' },
        { status: 400 }
      );
    }

    if (body.updates.length > MAX_UPDATES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_UPDATES_PER_REQUEST} updates per request` },
        { status: 400 }
      );
    }

    // Check for duplicate IDs
    const idSet = new Set<string>();
    for (const item of body.updates) {
      if (item.id && typeof item.id === 'string') {
        if (idSet.has(item.id)) {
          return NextResponse.json(
            { error: `Duplicate expense id: ${item.id}` },
            { status: 400 }
          );
        }
        idSet.add(item.id);
      }
    }

    // Phase 1: Validate all items synchronously (field-level)
    const itemErrors: ItemError[] = [];
    for (let i = 0; i < body.updates.length; i++) {
      const errors = validateUpdateItem(body.updates[i]);
      if (errors.length > 0) {
        itemErrors.push({ index: i, errors });
      }
    }

    if (itemErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: itemErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Phase 2: Fetch all existing expenses to validate they exist
    const expenseIds = body.updates.map((item: UpdateInput) => item.id as string);
    const { data: existingExpenses, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .in('id', expenseIds)
      .is('deleted_at', null);

    if (fetchError) throw fetchError;

    const existingMap = new Map<string, Record<string, unknown>>();
    for (const expense of existingExpenses || []) {
      existingMap.set(expense.id, expense as Record<string, unknown>);
    }

    // Check for missing expenses
    const missingErrors: ItemError[] = [];
    for (let i = 0; i < body.updates.length; i++) {
      const item = body.updates[i];
      if (!existingMap.has(item.id)) {
        missingErrors.push({ index: i, errors: ['Expense not found'] });
      }
    }

    if (missingErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: missingErrors },
        { status: 400 }
      );
    }

    // Phase 3: Validate XOR constraint and collect referenced event_ids/category_ids
    const eventIds = new Set<string>();
    const categoryIds = new Set<string>();
    const xorErrors: ItemError[] = [];

    for (let i = 0; i < body.updates.length; i++) {
      const item = body.updates[i];
      const existing = existingMap.get(item.id)!;

      // Determine final event_id and category_id after update
      const newEventId = item.event_id !== undefined ? item.event_id : existing.event_id;
      const newCategoryId = item.category_id !== undefined ? item.category_id : existing.category_id;

      const hasEventId = newEventId && newEventId !== '';
      const hasCategoryId = newCategoryId && newCategoryId !== '';

      const errors: string[] = [];
      if (hasEventId && hasCategoryId) {
        errors.push('Expense must be assigned to either an event OR a category, not both.');
      }
      if (!hasEventId && !hasCategoryId) {
        errors.push('Expense must be assigned to either an event or a category.');
      }

      if (errors.length > 0) {
        xorErrors.push({ index: i, errors });
      }

      // Collect referenced IDs for batch validation
      if (hasEventId && item.event_id !== undefined) {
        eventIds.add(newEventId as string);
      }
      if (hasCategoryId && item.category_id !== undefined) {
        categoryIds.add(newCategoryId as string);
      }
    }

    if (xorErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: xorErrors },
        { status: 400 }
      );
    }

    // Phase 4: Batch-validate referenced events and categories
    const validEvents = new Map<string, string>();
    if (eventIds.size > 0) {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, name')
        .in('id', [...eventIds])
        .is('deleted_at', null);

      if (eventsError) throw eventsError;

      for (const event of events || []) {
        validEvents.set(event.id, event.name);
      }
    }

    const validCategories = new Map<string, string>();
    if (categoryIds.size > 0) {
      const { data: categories, error: categoriesError } = await supabase
        .from('budget_categories')
        .select('id, name')
        .in('id', [...categoryIds])
        .is('deleted_at', null);

      if (categoriesError) throw categoriesError;

      for (const category of categories || []) {
        validCategories.set(category.id, category.name);
      }
    }

    // Check for missing events/categories
    const refErrors: ItemError[] = [];
    for (let i = 0; i < body.updates.length; i++) {
      const item = body.updates[i];
      const errors: string[] = [];

      if (item.event_id !== undefined && item.event_id && item.event_id !== '' && !validEvents.has(item.event_id)) {
        errors.push('Event not found');
      }
      if (item.category_id !== undefined && item.category_id && item.category_id !== '' && !validCategories.has(item.category_id)) {
        errors.push('Category not found');
      }

      if (errors.length > 0) {
        refErrors.push({ index: i, errors });
      }
    }

    if (refErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: refErrors },
        { status: 400 }
      );
    }

    // Phase 5: Apply all updates (track per-item results)
    const updatedExpenses: Record<string, unknown>[] = [];
    const itemResults: Array<{ id: string; status: 'updated' | 'error'; error?: string }> = [];
    const now = new Date().toISOString();

    for (const item of body.updates) {
      const existing = existingMap.get(item.id as string)!;

      try {
        const updateData: Record<string, unknown> = {
          updated_at: now,
        };

        // Resolve event_id / category_id with XOR clearing
        if (item.event_id !== undefined) {
          updateData.event_id = item.event_id || null;
          if (item.event_id) updateData.category_id = null;
        }
        if (item.category_id !== undefined) {
          updateData.category_id = item.category_id || null;
          if (item.category_id) updateData.event_id = null;
        }

        if (item.amount !== undefined) updateData.amount = parseFloat(String(item.amount));
        if (item.expense_date !== undefined) updateData.expense_date = item.expense_date;
        if (item.vendor !== undefined) updateData.vendor = item.vendor;
        if (item.memo !== undefined) updateData.memo = item.memo;

        const { data: updated, error: updateError } = await supabase
          .from('expenses')
          .update(updateData)
          .eq('id', item.id as string)
          .is('deleted_at', null)
          .select('*')
          .single();

        if (updateError) throw updateError;

        updatedExpenses.push(updated as Record<string, unknown>);
        itemResults.push({ id: item.id as string, status: 'updated' });

        // Audit log (non-blocking)
        try {
          const { actor, actor_type } = await getActor(request);
          const changes = computeChanges(existing, updated as Record<string, unknown>, AUDIT_FIELDS);
          logAudit({
            entity_type: 'expense',
            entity_id: item.id as string,
            action: 'update',
            changes,
            actor,
            actor_type,
          });
        } catch (e) {
          console.error('Audit log failed:', e);
        }
      } catch (error) {
        itemResults.push({
          id: item.id as string,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Collect all event/category IDs from updated expenses for name resolution
    const allEventIds = new Set<string>();
    const allCategoryIds = new Set<string>();
    for (const expense of updatedExpenses) {
      if (expense.event_id) allEventIds.add(expense.event_id as string);
      if (expense.category_id) allCategoryIds.add(expense.category_id as string);
    }

    // Fetch any event/category names we don't already have
    const allEvents = new Map(validEvents);
    const missingEventIds = [...allEventIds].filter(id => !allEvents.has(id));
    if (missingEventIds.length > 0) {
      const { data: events } = await supabase
        .from('events')
        .select('id, name')
        .in('id', missingEventIds)
        .is('deleted_at', null);

      for (const event of events || []) {
        allEvents.set(event.id, event.name);
      }
    }

    const allCategories = new Map(validCategories);
    const missingCategoryIds = [...allCategoryIds].filter(id => !allCategories.has(id));
    if (missingCategoryIds.length > 0) {
      const { data: categories } = await supabase
        .from('budget_categories')
        .select('id, name')
        .in('id', missingCategoryIds)
        .is('deleted_at', null);

      for (const category of categories || []) {
        allCategories.set(category.id, category.name);
      }
    }

    // Build response with relation fields
    const expenses = updatedExpenses.map(expense => {
      const eventName = expense.event_id ? (allEvents.get(expense.event_id as string) ?? null) : null;
      const categoryName = expense.category_id ? (allCategories.get(expense.category_id as string) ?? null) : null;

      return {
        ...expense,
        event_name: eventName,
        category_name: categoryName,
        target_type: expense.event_id ? 'event' as const : 'category' as const,
        target_name: eventName || categoryName || 'Unknown',
      };
    });

    const hasErrors = itemResults.some(r => r.status === 'error');

    return NextResponse.json({
      expenses,
      meta: {
        total: body.updates.length,
        updated: itemResults.filter(r => r.status === 'updated').length,
        errors: itemResults.filter(r => r.status === 'error').length,
      },
      ...(hasErrors ? { results: itemResults } : {}),
    }, { status: hasErrors ? 207 : 200 });
  } catch (err) {
    console.error('Bulk update expenses error:', err);
    logError('Failed to bulk update expenses', { error: err as Error, source: 'api/expenses/bulk/update', context: { method: 'PUT' } });
    return NextResponse.json(
      { error: 'Failed to update expenses' },
      { status: 500 }
    );
  }
});
