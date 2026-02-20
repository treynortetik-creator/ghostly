/**
 * The Counting House - Board API
 *
 * GET /api/events/board - Events grouped by stage for Kanban board view
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler } from '@/lib/api-helpers';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { EventTypeRecord, EventStage } from '@/types/database';

interface EventBoardCard {
  id: string;
  name: string;
  date_start: string | null;
  date_end: string | null;
  location: string | null;
  tier: string | null;
  stage: string;
  budget_amount: number;
  shipping_handler: string;
  event_type_record: { id: string; name: string } | null;
  task_counts: { total: number; completed: number };
  actual_spent: number;
  remaining: number;
  days_until: number | null;
}

const BOARD_STAGES: EventStage[] = ['confirmed', 'in_progress', 'ready', 'active', 'debrief'];

// ============================================
// GET /api/events/board
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'events/board' },
  async () => {
    const supabase = await createClient();
    const today = new Date();

    // Fetch non-archived events, expenses, and checklist items in parallel
    const [eventsResult, expenseTotalsResult, checklistResult] = await Promise.all([
      supabase
        .from('events')
        .select('*, event_types(*)')
        .is('deleted_at', null)
        .or('stage.neq.archived,stage.is.null'),
      supabase
        .from('expenses')
        .select('event_id, amount')
        .not('event_id', 'is', null)
        .is('deleted_at', null),
      supabase
        .from('event_checklist_items')
        .select('event_id, completed_at'),
    ]);

    if (eventsResult.error) throw eventsResult.error;

    // Build expense totals map
    const expenseByEvent = new Map<string, { total: number; count: number }>();
    for (const exp of expenseTotalsResult.data || []) {
      if (exp.event_id) {
        const prev = expenseByEvent.get(exp.event_id) || { total: 0, count: 0 };
        expenseByEvent.set(exp.event_id, { total: prev.total + exp.amount, count: prev.count + 1 });
      }
    }

    // Build task counts per event
    const taskCountsByEvent = new Map<string, { total: number; completed: number }>();
    for (const item of checklistResult.data || []) {
      const counts = taskCountsByEvent.get(item.event_id) || { total: 0, completed: 0 };
      counts.total++;
      if (item.completed_at) counts.completed++;
      taskCountsByEvent.set(item.event_id, counts);
    }

    // Initialize stage buckets
    const stages: Record<string, EventBoardCard[]> = {
      confirmed: [],
      in_progress: [],
      ready: [],
      active: [],
      debrief: [],
    };

    // Map events to board cards and group by stage
    for (const event of eventsResult.data || []) {
      const stats = expenseByEvent.get(event.id) || { total: 0, count: 0 };
      const tasks = taskCountsByEvent.get(event.id) || { total: 0, completed: 0 };
      const { event_types, ...eventData } = event as typeof event & { event_types: EventTypeRecord | null };

      // Determine stage (default to 'confirmed' if null)
      const stage = (eventData.stage || 'confirmed') as string;
      if (!stages[stage]) continue; // skip any unexpected stage values

      const daysUntil = eventData.date_start
        ? differenceInCalendarDays(parseISO(eventData.date_start), today)
        : null;

      const card: EventBoardCard = {
        id: eventData.id,
        name: eventData.name,
        date_start: eventData.date_start,
        date_end: eventData.date_end,
        location: eventData.location,
        tier: eventData.tier,
        stage,
        budget_amount: eventData.budget_amount ?? 0,
        shipping_handler: eventData.shipping_handler,
        event_type_record: event_types ? { id: event_types.id, name: event_types.name } : null,
        task_counts: tasks,
        actual_spent: stats.total,
        remaining: (eventData.budget_amount ?? 0) - stats.total,
        days_until: daysUntil,
      };

      stages[stage].push(card);
    }

    // Sort each stage by date_start ascending (nulls at end)
    for (const stage of BOARD_STAGES) {
      stages[stage].sort((a, b) => {
        if (a.date_start && b.date_start) return a.date_start.localeCompare(b.date_start);
        if (a.date_start && !b.date_start) return -1;
        if (!a.date_start && b.date_start) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    // Build totals
    const totals = {
      confirmed: stages.confirmed.length,
      in_progress: stages.in_progress.length,
      ready: stages.ready.length,
      active: stages.active.length,
      debrief: stages.debrief.length,
    };

    return NextResponse.json({ stages, totals });
  }
);
