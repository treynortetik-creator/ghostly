# Configurable Event Type Budgets - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded event type enum with database-driven configurable event types that have per-fiscal-year budgets, manageable via Settings page.

**Architecture:** New `event_types` table with FK from `events`. API endpoints for CRUD. Settings page section for management. Migration handles existing enum data.

**Tech Stack:** Next.js 14, Supabase, TypeScript, Tailwind CSS

---

## Phase 1: Database Schema

### Task 1.1: Create event_types table migration

**Files:**
- Create: `supabase/migrations/010_event_types_table.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration: Create event_types table and migrate from enum
-- This replaces the hardcoded event_type enum with a configurable table

-- 1. Create the event_types table
CREATE TABLE event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  budget_amount DECIMAL(12,2) DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create unique index for name per fiscal year (only for non-archived)
CREATE UNIQUE INDEX event_types_name_fiscal_year_idx
  ON event_types(LOWER(name), fiscal_year_id)
  WHERE is_archived = FALSE;

-- 3. Create index for fiscal year lookups
CREATE INDEX event_types_fiscal_year_idx ON event_types(fiscal_year_id);

-- 4. Add event_type_id column to events table
ALTER TABLE events ADD COLUMN event_type_id UUID REFERENCES event_types(id);

-- 5. Insert default event types for each existing fiscal year
INSERT INTO event_types (name, description, fiscal_year_id, budget_amount, display_order)
SELECT
  type_data.name,
  type_data.description,
  fy.id,
  0,
  type_data.display_order
FROM fiscal_years fy
CROSS JOIN (
  VALUES
    ('Executive', 'C-suite conferences and leadership events', 1),
    ('National', 'Industry-wide conferences and associations', 2),
    ('State', 'State-level associations and regional events', 3),
    ('Regional', 'Multi-state regional gatherings', 4),
    ('Customer', 'Customer appreciation and engagement events', 5)
) AS type_data(name, description, display_order);

-- 6. Migrate existing events to use the new event_type_id
UPDATE events e
SET event_type_id = et.id
FROM event_types et
WHERE LOWER(e.event_type::text) = LOWER(et.name)
  AND e.fiscal_year_id = et.fiscal_year_id;

-- 7. Handle events with NULL fiscal_year_id (assign to 2026 fiscal year types)
UPDATE events e
SET event_type_id = et.id
FROM event_types et
JOIN fiscal_years fy ON et.fiscal_year_id = fy.id
WHERE e.event_type_id IS NULL
  AND LOWER(e.event_type::text) = LOWER(et.name)
  AND fy.year = 2026;

-- 8. Drop the old event_type column and enum
ALTER TABLE events DROP COLUMN event_type;
DROP TYPE IF EXISTS event_type;
```

**Step 2: Apply the migration**

Run: `npx supabase db push` or apply via Supabase dashboard

**Step 3: Verify migration**

Run SQL in Supabase:
```sql
SELECT * FROM event_types ORDER BY fiscal_year_id, display_order;
SELECT id, name, event_type_id FROM events LIMIT 5;
```

**Step 4: Commit**

```bash
git add supabase/migrations/010_event_types_table.sql
git commit -m "feat(db): add event_types table and migrate from enum"
```

---

## Phase 2: TypeScript Types

### Task 2.1: Add EventType interface and update types

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Add EventType interface after line 27 (after FiscalYear)**

```typescript
/**
 * Event type record - configurable event categories with budgets
 */
export interface EventTypeRecord {
  id: string;
  name: string;
  description: string | null;
  fiscal_year_id: string | null;
  budget_amount: number;
  is_archived: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Event type with computed totals for display
 */
export interface EventTypeWithTotals extends EventTypeRecord {
  actual_spent: number;
  event_count: number;
  remaining: number;
}
```

**Step 2: Update Event interface (around line 42)**

Change:
```typescript
event_type: EventType;
```

To:
```typescript
event_type_id: string | null;
```

**Step 3: Add extended Event type with event_type joined**

After EventWithFiscalYear interface:
```typescript
/**
 * Event with its event type populated
 */
export interface EventWithEventType extends Event {
  event_type: EventTypeRecord | null;
}
```

**Step 4: Remove old EventType union type and eventTypeLabels**

Delete lines 10 and 191-197:
```typescript
// DELETE: export type EventType = 'executive' | 'national' | 'state' | 'regional' | 'customer';
// DELETE: export const eventTypeLabels: Record<EventType, string> = { ... };
```

**Step 5: Update Database interface for Supabase**

Add event_types table definition in the Tables section and update events table to use event_type_id instead of event_type.

**Step 6: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add EventTypeRecord interface, update Event to use FK"
```

---

## Phase 3: Event Types API

### Task 3.1: Create GET/POST /api/event-types endpoint

**Files:**
- Create: `src/app/api/event-types/route.ts`

**Step 1: Create the route file**

```typescript
/**
 * The Counting House - Event Types API
 *
 * Endpoints:
 * GET /api/event-types - List event types for a fiscal year
 * POST /api/event-types - Create a new event type
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface EventTypeWithTotals {
  id: string;
  name: string;
  description: string | null;
  fiscal_year_id: string | null;
  budget_amount: number;
  is_archived: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  actual_spent: number;
  event_count: number;
  remaining: number;
}

// ============================================
// GET /api/event-types
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fiscalYearId = searchParams.get('fiscal_year_id');
    const includeArchived = searchParams.get('include_archived') === 'true';

    if (!fiscalYearId) {
      return NextResponse.json(
        { error: 'fiscal_year_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    let query = supabase
      .from('event_types')
      .select('*')
      .eq('fiscal_year_id', fiscalYearId)
      .order('display_order', { ascending: true });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const [eventTypesResult, eventsResult, expensesResult] = await Promise.all([
      query,
      supabase
        .from('events')
        .select('id, event_type_id, budget_amount')
        .eq('fiscal_year_id', fiscalYearId)
        .is('deleted_at', null),
      supabase
        .from('expenses')
        .select('event_id, amount')
        .is('deleted_at', null),
    ]);

    if (eventTypesResult.error) throw eventTypesResult.error;

    // Build event counts and expense totals per event type
    const eventsByType = new Map<string, { count: number; eventIds: Set<string> }>();
    for (const event of eventsResult.data || []) {
      if (event.event_type_id) {
        const prev = eventsByType.get(event.event_type_id) || { count: 0, eventIds: new Set() };
        prev.count++;
        prev.eventIds.add(event.id);
        eventsByType.set(event.event_type_id, prev);
      }
    }

    // Sum expenses per event type
    const expensesByType = new Map<string, number>();
    for (const expense of expensesResult.data || []) {
      if (expense.event_id) {
        for (const [typeId, { eventIds }] of eventsByType) {
          if (eventIds.has(expense.event_id)) {
            expensesByType.set(typeId, (expensesByType.get(typeId) || 0) + expense.amount);
          }
        }
      }
    }

    const eventTypes: EventTypeWithTotals[] = (eventTypesResult.data || []).map(et => {
      const stats = eventsByType.get(et.id) || { count: 0 };
      const actualSpent = expensesByType.get(et.id) || 0;
      const budgetAmount = et.budget_amount ?? 0;
      return {
        ...et,
        budget_amount: budgetAmount,
        actual_spent: actualSpent,
        event_count: stats.count,
        remaining: budgetAmount - actualSpent,
      };
    });

    return NextResponse.json({ event_types: eventTypes });
  } catch (error) {
    console.error('Event Types API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event types' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/event-types
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!body.fiscal_year_id) {
      return NextResponse.json(
        { error: 'fiscal_year_id is required' },
        { status: 400 }
      );
    }

    if (String(body.name).length > 100) {
      return NextResponse.json(
        { error: 'Name must be 100 characters or fewer' },
        { status: 400 }
      );
    }

    const budgetAmount = parseFloat(body.budget_amount) || 0;
    if (budgetAmount < 0) {
      return NextResponse.json(
        { error: 'Budget amount must be zero or positive' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check for duplicate name in same fiscal year
    const { data: existing } = await supabase
      .from('event_types')
      .select('id')
      .eq('fiscal_year_id', body.fiscal_year_id)
      .ilike('name', body.name.trim())
      .eq('is_archived', false);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'An event type with this name already exists' },
        { status: 400 }
      );
    }

    // Get max display_order for this fiscal year
    const { data: maxOrder } = await supabase
      .from('event_types')
      .select('display_order')
      .eq('fiscal_year_id', body.fiscal_year_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const displayOrder = (maxOrder?.[0]?.display_order ?? -1) + 1;

    const { data: newEventType, error: insertError } = await supabase
      .from('event_types')
      .insert({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        fiscal_year_id: body.fiscal_year_id,
        budget_amount: budgetAmount,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({
      ...newEventType,
      actual_spent: 0,
      event_count: 0,
      remaining: newEventType.budget_amount ?? 0,
    }, { status: 201 });
  } catch (error) {
    console.error('Create event type error:', error);
    return NextResponse.json(
      { error: 'Failed to create event type' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/event-types/route.ts
git commit -m "feat(api): add GET/POST /api/event-types endpoints"
```

---

### Task 3.2: Create GET/PUT/DELETE /api/event-types/[id] endpoint

**Files:**
- Create: `src/app/api/event-types/[id]/route.ts`

**Step 1: Create the route file**

```typescript
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

// ============================================
// GET /api/event-types/[id]
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
  } catch (error) {
    console.error('Get event type error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event type' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/event-types/[id]
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (body.name) {
      const { data: duplicate } = await supabase
        .from('event_types')
        .select('id')
        .eq('fiscal_year_id', existing.fiscal_year_id)
        .ilike('name', body.name.trim())
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update event type error:', error);
    return NextResponse.json(
      { error: 'Failed to update event type' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/event-types/[id]
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    return NextResponse.json({ message: 'Event type archived', event_type: archived });
  } catch (error) {
    console.error('Archive event type error:', error);
    return NextResponse.json(
      { error: 'Failed to archive event type' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/event-types/[id]/route.ts
git commit -m "feat(api): add GET/PUT/DELETE /api/event-types/[id] endpoints"
```

---

## Phase 4: Settings Page UI

### Task 4.1: Create EventTypeForm component

**Files:**
- Create: `src/components/settings/EventTypeForm.tsx`

**Step 1: Create the form component**

```typescript
'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import type { EventTypeRecord } from '@/types/database';

export interface EventTypeFormData {
  name: string;
  budget_amount: string;
  description: string;
}

export interface EventTypeFormProps {
  eventType?: EventTypeRecord;
  onSubmit: (data: EventTypeFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

const sanitizeCurrency = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

export function EventTypeForm({
  eventType,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}: EventTypeFormProps) {
  const [formData, setFormData] = useState<EventTypeFormData>({
    name: eventType?.name || '',
    budget_amount: eventType?.budget_amount?.toString() || '0',
    description: eventType?.description || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EventTypeFormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EventTypeFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    const budget = parseFloat(formData.budget_amount);
    if (isNaN(budget) || budget < 0) {
      newErrors.budget_amount = 'Budget must be zero or positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(formData);
  };

  const handleChange = (field: keyof EventTypeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const inputClasses = `
    w-full px-4 py-2.5 rounded-md
    bg-parchment border border-wood-medium/40
    text-ink-black placeholder-sepia/50
    focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const labelClasses = 'block text-sm font-medium text-wood-dark mb-1.5';
  const errorClasses = 'text-xs text-ink-red mt-1';

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Add Event Type' : 'Edit Event Type'}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="name" className={labelClasses}>
              Name <span className="text-ink-red">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={inputClasses}
              placeholder="e.g., Executive"
              disabled={isLoading}
            />
            {errors.name && <p className={errorClasses}>{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="budget_amount" className={labelClasses}>
              Budget Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia">$</span>
              <input
                type="text"
                id="budget_amount"
                value={formData.budget_amount}
                onChange={(e) => handleChange('budget_amount', sanitizeCurrency(e.target.value))}
                className={`${inputClasses} pl-7`}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
            {errors.budget_amount && <p className={errorClasses}>{errors.budget_amount}</p>}
          </div>

          <div>
            <label htmlFor="description" className={labelClasses}>
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className={`${inputClasses} min-h-[80px] resize-y`}
              placeholder="Brief description of this event type..."
              disabled={isLoading}
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
          >
            {mode === 'create' ? 'Add Type' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default EventTypeForm;
```

**Step 2: Commit**

```bash
git add src/components/settings/EventTypeForm.tsx
git commit -m "feat(ui): add EventTypeForm component"
```

---

### Task 4.2: Create EventTypesSection component

**Files:**
- Create: `src/components/settings/EventTypesSection.tsx`

**Step 1: Create the section component**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MoreVertical, Pencil, Archive, GripVertical, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { EventTypeForm, EventTypeFormData } from './EventTypeForm';
import type { EventTypeWithTotals } from '@/types/database';

interface EventTypesSectionProps {
  fiscalYearId: string;
  disabled?: boolean;
}

export function EventTypesSection({ fiscalYearId, disabled = false }: EventTypesSectionProps) {
  const [eventTypes, setEventTypes] = useState<EventTypeWithTotals[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<EventTypeWithTotals | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const fetchEventTypes = useCallback(async () => {
    if (!fiscalYearId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/event-types?fiscal_year_id=${fiscalYearId}`);
      if (!response.ok) throw new Error('Failed to fetch event types');
      const data = await response.json();
      setEventTypes(data.event_types || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event types');
    } finally {
      setIsLoading(false);
    }
  }, [fiscalYearId]);

  useEffect(() => {
    fetchEventTypes();
  }, [fetchEventTypes]);

  const handleCreate = async (data: EventTypeFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/event-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          fiscal_year_id: fiscalYearId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create event type');
      }

      setShowForm(false);
      fetchEventTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create event type');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: EventTypeFormData) => {
    if (!editingType) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/event-types/${editingType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update event type');
      }

      setEditingType(null);
      fetchEventTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update event type');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this event type? It will no longer appear in dropdowns but existing events will keep their association.')) {
      return;
    }

    try {
      const response = await fetch(`/api/event-types/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to archive event type');
      }

      fetchEventTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive event type');
    }
    setOpenMenu(null);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (showForm) {
    return (
      <EventTypeForm
        onSubmit={handleCreate}
        onCancel={() => setShowForm(false)}
        isLoading={isSaving}
        mode="create"
      />
    );
  }

  if (editingType) {
    return (
      <EventTypeForm
        eventType={editingType}
        onSubmit={handleUpdate}
        onCancel={() => setEditingType(null)}
        isLoading={isSaving}
        mode="edit"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-ink-gold/10 text-ink-gold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Event Type Budgets</CardTitle>
              <CardDescription>
                Budget allocations by event category for the selected fiscal year
              </CardDescription>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowForm(true)}
            disabled={disabled || !fiscalYearId}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Type
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="text-center py-8 text-sepia">Loading event types...</div>
        )}

        {error && (
          <div className="text-center py-8 text-ink-red">{error}</div>
        )}

        {!isLoading && !error && eventTypes.length === 0 && (
          <div className="text-center py-8 text-sepia">
            No event types configured for this fiscal year.
          </div>
        )}

        {!isLoading && !error && eventTypes.length > 0 && (
          <div className="space-y-2">
            {eventTypes.map((et) => (
              <div
                key={et.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors group"
              >
                <GripVertical className="w-4 h-4 text-sepia/40 cursor-grab" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-wood-dark">{et.name}</span>
                    <span className="text-xs text-sepia">
                      ({et.event_count} event{et.event_count !== 1 ? 's' : ''})
                    </span>
                  </div>
                  {et.description && (
                    <p className="text-xs text-sepia truncate">{et.description}</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="font-medium text-ink-gold tabular-nums">
                    {formatCurrency(et.budget_amount)}
                  </p>
                  <p className="text-xs text-sepia">
                    {formatCurrency(et.actual_spent)} spent
                  </p>
                </div>

                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === et.id ? null : et.id);
                    }}
                    className="p-1.5 rounded hover:bg-wood-medium/10 text-sepia hover:text-wood-dark transition-colors"
                    disabled={disabled}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {openMenu === et.id && (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-wood-medium/20 rounded-lg shadow-lg z-10">
                      <button
                        onClick={() => {
                          setEditingType(et);
                          setOpenMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-wood-dark hover:bg-parchment transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleArchive(et.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-red hover:bg-ink-red/5 transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EventTypesSection;
```

**Step 2: Export from settings index**

Modify: `src/components/settings/index.ts`

Add:
```typescript
export { EventTypesSection } from './EventTypesSection';
export { EventTypeForm } from './EventTypeForm';
```

**Step 3: Commit**

```bash
git add src/components/settings/EventTypesSection.tsx src/components/settings/index.ts
git commit -m "feat(ui): add EventTypesSection component for Settings page"
```

---

### Task 4.3: Add EventTypesSection to Settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

**Step 1: Import EventTypesSection**

Add to imports at top:
```typescript
import { FiscalYearSelector, ModelSelector, PromptEditor, EventTypesSection } from '@/components/settings';
```

**Step 2: Add EventTypesSection after FiscalYearSelector**

After line 267 (after the settings grid), add:
```typescript
          {/* Event Type Budgets */}
          {settings.fiscal_year_id && (
            <EventTypesSection
              fiscalYearId={settings.fiscal_year_id}
              disabled={isSaving}
            />
          )}
```

**Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(ui): add Event Type Budgets section to Settings page"
```

---

## Phase 5: Update Events Components

### Task 5.1: Update EventForm to use event_type_id

**Files:**
- Modify: `src/components/events/EventForm.tsx`

**Step 1: Update imports**

Replace:
```typescript
import type { Event, EventType, QuarterType } from '@/types/database';
import { eventTypeLabels, quarterLabels } from '@/types/database';
```

With:
```typescript
import type { Event, QuarterType, EventTypeRecord } from '@/types/database';
import { quarterLabels } from '@/types/database';
```

**Step 2: Add state for event types**

After the existing useState declarations, add:
```typescript
const [eventTypes, setEventTypes] = useState<EventTypeRecord[]>([]);
const [loadingTypes, setLoadingTypes] = useState(true);
```

**Step 3: Fetch event types on mount**

Add useEffect:
```typescript
useEffect(() => {
  const fetchEventTypes = async () => {
    try {
      // Get fiscal year from form or fetch current
      const fyId = formData.fiscal_year_id;
      if (!fyId) {
        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.settings?.fiscal_year_id) {
            const res = await fetch(`/api/event-types?fiscal_year_id=${settings.settings.fiscal_year_id}`);
            if (res.ok) {
              const data = await res.json();
              setEventTypes(data.event_types || []);
            }
          }
        }
      } else {
        const res = await fetch(`/api/event-types?fiscal_year_id=${fyId}`);
        if (res.ok) {
          const data = await res.json();
          setEventTypes(data.event_types || []);
        }
      }
    } catch (err) {
      console.error('Failed to load event types:', err);
    } finally {
      setLoadingTypes(false);
    }
  };
  fetchEventTypes();
}, [formData.fiscal_year_id]);
```

**Step 4: Update EventFormData interface**

Change `event_type: EventType` to `event_type_id: string`

**Step 5: Update initial state**

Change:
```typescript
event_type: event?.event_type || 'national',
```
To:
```typescript
event_type_id: event?.event_type_id || '',
```

**Step 6: Update select element in JSX**

Replace the event type select with:
```typescript
<select
  id="event_type_id"
  value={formData.event_type_id}
  onChange={(e) => handleChange('event_type_id', e.target.value)}
  className={inputClasses}
  disabled={isLoading || loadingTypes}
>
  <option value="">Select event type...</option>
  {eventTypes.map(type => (
    <option key={type.id} value={type.id}>
      {type.name}
    </option>
  ))}
</select>
```

**Step 7: Remove hardcoded eventTypes constant**

Delete:
```typescript
const eventTypes: EventType[] = ['executive', 'national', 'state', 'regional', 'customer'];
```

**Step 8: Commit**

```bash
git add src/components/events/EventForm.tsx
git commit -m "feat(ui): update EventForm to use event_type_id from API"
```

---

### Task 5.2: Update EventFilters to use event_type_id

**Files:**
- Modify: `src/components/events/EventFilters.tsx`

Similar changes - fetch event types from API instead of using hardcoded array.

**Step 1: Update to fetch event types dynamically**

Add state and useEffect to fetch event types, update the select to use fetched data.

**Step 2: Commit**

```bash
git add src/components/events/EventFilters.tsx
git commit -m "feat(ui): update EventFilters to fetch event types from API"
```

---

## Phase 6: Update Events API

### Task 6.1: Update GET /api/events to join event_types

**Files:**
- Modify: `src/app/api/events/route.ts`

**Step 1: Update query to join event_types**

Add join in select and include event type info in response.

**Step 2: Update POST validation**

Remove hardcoded event_type validation, validate event_type_id exists in database.

**Step 3: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "feat(api): update events API to use event_type_id FK"
```

---

### Task 6.2: Update GET /api/events/[id] to join event_types

**Files:**
- Modify: `src/app/api/events/[id]/route.ts`

Similar changes to include event type in response.

**Step 1: Commit**

```bash
git add src/app/api/events/[id]/route.ts
git commit -m "feat(api): update event detail API to include event_type"
```

---

## Phase 7: Update Dashboard

### Task 7.1: Update dashboard summary to use event_types table

**Files:**
- Modify: `src/app/api/dashboard/summary/route.ts`

**Step 1: Query event_types table for budgets**

Replace the hardcoded eventTypes array iteration with a query to the event_types table.

```typescript
// Replace lines 121-131 with:
const { data: eventTypesData } = await supabase
  .from('event_types')
  .select('*')
  .eq('fiscal_year_id', fiscalYearId)
  .eq('is_archived', false)
  .order('display_order');

const byEventType = (eventTypesData || []).map(et => {
  const eventsOfType = (activeEvents ?? []).filter(e => e.event_type_id === et.id);
  const eventIds = new Set(eventsOfType.map(e => e.id));
  const actual = scopedExpenses
    .filter(e => e.event_id && eventIds.has(e.event_id))
    .reduce((sum, e) => sum + e.amount, 0);
  return {
    id: et.id,
    type: et.name,
    budget: et.budget_amount ?? 0,
    actual,
    description: et.description,
  };
});
```

**Step 2: Commit**

```bash
git add src/app/api/dashboard/summary/route.ts
git commit -m "feat(api): update dashboard summary to use event_types table"
```

---

## Phase 8: Update Remaining Files

### Task 8.1: Update EventCard display

**Files:**
- Modify: `src/components/events/EventCard.tsx`

Update to display event type from joined data instead of using eventTypeLabels.

### Task 8.2: Update EventTypeSummary component

**Files:**
- Modify: `src/components/dashboard/EventTypeSummary.tsx`

Update EventTypeData interface to accept name string instead of EventType enum.

### Task 8.3: Update export endpoints

**Files:**
- Modify: `src/app/api/export/csv/route.ts`
- Modify: `src/app/api/export/excel/route.ts`

Join event_types to get name for export.

### Task 8.4: Update import endpoints

**Files:**
- Modify: `src/app/api/import/brex/route.ts`
- Modify: `src/app/api/import/pdf/route.ts`

Match event type by name, handle missing types gracefully.

### Task 8.5: Update ROI endpoints

**Files:**
- Modify: `src/app/api/dashboard/roi/route.ts`
- Modify: `src/app/api/events/[id]/roi/route.ts`

Join event_types for display.

### Task 8.6: Update seed.sql

**Files:**
- Modify: `supabase/seed.sql`

Update to use event_type_id instead of event_type enum.

---

## Verification

After completing all tasks:

1. **Run the dev server:** `npm run dev`
2. **Test Settings page:**
   - Navigate to Settings
   - Verify Event Type Budgets section appears
   - Create a new event type
   - Edit an existing event type budget
   - Archive an event type
3. **Test Events:**
   - Create a new event, verify event type dropdown works
   - Edit existing event, verify event type is preserved
   - Verify event filters work with new event types
4. **Test Dashboard:**
   - Verify Budget by Event Type shows correct budgets from event_types table
   - Verify actual spent calculations are correct
5. **Run build:** `npm run build` - verify no TypeScript errors
6. **Test in production:** Deploy and verify on Railway
