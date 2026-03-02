/**
 * Ghostly - Calendar API
 *
 * GET /api/events/calendar?month=YYYY-MM - Events and tasks for a calendar month
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { startOfMonth, endOfMonth, parseISO, format, isBefore } from 'date-fns';
import type { EventTypeRecord } from '@/types/database';

// ============================================
// GET /api/events/calendar
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'events/calendar' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    // Validate month parameter (required, format YYYY-MM)
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Missing or invalid month parameter. Expected format: YYYY-MM' },
        { status: 400 }
      );
    }

    // Parse the month into a date range
    const monthDate = parseISO(`${month}-01`);
    if (isNaN(monthDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid month parameter. Could not parse date.' },
        { status: 400 }
      );
    }

    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const startDateStr = format(monthStart, 'yyyy-MM-dd');
    const endDateStr = format(monthEnd, 'yyyy-MM-dd');
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const supabase = await createClient();

    // Fetch events that overlap the month, expenses, and checklist items in parallel (scoped to org)
    const [eventsResult, expenseTotalsResult, checklistResult] = await Promise.all([
      supabase
        .from('events')
        .select('*, event_types(*)')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .not('date_start', 'is', null)
        .lte('date_start', endDateStr)
        .or(`date_end.gte.${startDateStr},and(date_end.is.null,date_start.gte.${startDateStr})`),
      supabase
        .from('expenses')
        .select('event_id, amount')
        .eq('organization_id', orgId)
        .not('event_id', 'is', null)
        .neq('budget_bucket', 'travel')
        .is('deleted_at', null),
      supabase
        .from('event_checklist_items')
        .select('id, event_id, title, due_date, completed_at'),
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

    // Build checklist maps: task_counts per event, and task_dates for the month
    const eventIds = new Set((eventsResult.data || []).map(e => e.id));
    const eventNameMap = new Map<string, string>();
    for (const e of eventsResult.data || []) {
      eventNameMap.set(e.id, e.name);
    }

    // Group checklist items by event for task counts
    const taskCountsByEvent = new Map<string, { total: number; completed: number; overdue: number }>();
    const taskDates: Record<string, { count: number; tasks: Array<{ id: string; title: string; event_name: string; event_id: string; due_date: string; completed: boolean }> }> = {};

    for (const item of checklistResult.data || []) {
      if (!eventIds.has(item.event_id)) continue;

      // Accumulate task counts
      const counts = taskCountsByEvent.get(item.event_id) || { total: 0, completed: 0, overdue: 0 };
      counts.total++;
      if (item.completed_at) {
        counts.completed++;
      } else if (item.due_date && isBefore(parseISO(item.due_date), parseISO(todayStr))) {
        counts.overdue++;
      }
      taskCountsByEvent.set(item.event_id, counts);

      // Build task_dates for items with due_date within the month
      if (item.due_date && item.due_date >= startDateStr && item.due_date <= endDateStr) {
        const dateKey = item.due_date;
        if (!taskDates[dateKey]) {
          taskDates[dateKey] = { count: 0, tasks: [] };
        }
        taskDates[dateKey].count++;
        taskDates[dateKey].tasks.push({
          id: item.id,
          title: item.title,
          event_name: eventNameMap.get(item.event_id) || '',
          event_id: item.event_id,
          due_date: item.due_date,
          completed: !!item.completed_at,
        });
      }
    }

    // Map events to response shape
    const events = (eventsResult.data || []).map(event => {
      const stats = expenseByEvent.get(event.id) || { total: 0, count: 0 };
      const tasks = taskCountsByEvent.get(event.id) || { total: 0, completed: 0, overdue: 0 };
      const { event_types, ...eventData } = event as typeof event & { event_types: EventTypeRecord | null };

      return {
        id: eventData.id,
        name: eventData.name,
        date_start: eventData.date_start,
        date_end: eventData.date_end,
        location: eventData.location,
        tier: eventData.tier,
        stage: eventData.stage,
        budget_amount: eventData.budget_amount ?? 0,
        shipping_handler: eventData.shipping_handler,
        event_type_record: event_types ? { id: event_types.id, name: event_types.name } : null,
        task_counts: tasks,
        actual_spent: stats.total,
        remaining: (eventData.budget_amount ?? 0) - stats.total,
      };
    });

    return NextResponse.json({
      events,
      task_dates: taskDates,
      month,
    });
  }
);
