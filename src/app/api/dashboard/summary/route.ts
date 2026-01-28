/**
 * The Counting House - Dashboard Summary API
 * Returns budget vs actual data for the main dashboard
 *
 * Endpoints:
 * GET /api/dashboard/summary - Returns dashboard summary data
 */

import { NextResponse } from 'next/server';
import { logError } from '@/lib/error-logger';
import { getSession } from '@/lib/auth';
import type { EventType, QuarterType } from '@/types/database';
import { createClient } from '@/lib/supabase/server';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface DashboardSummary {
  total: {
    budget: number;
    allocated: number;
    actual: number;
    remaining: number;
  };
  byEventType: {
    type: EventType;
    budget: number;
    actual: number;
  }[];
  byQuarter: {
    quarter: QuarterType;
    budget: number;
    actual: number;
  }[];
  byCategory: {
    name: string;
    budget: number;
    actual: number;
  }[];
}

// ============================================
// API HANDLER
// ============================================

export async function GET() {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Fetch all datasets in parallel (including app_settings for total_budget)
    const [
      { data: activeEvents, error: eventsErr },
      { data: activeCategories, error: catsErr },
      { data: activeExpenses, error: expErr },
      { data: settingsRow },
    ] = await Promise.all([
      supabase.from('events').select('*').is('deleted_at', null),
      supabase.from('budget_categories').select('*').is('deleted_at', null),
      supabase.from('expenses').select('*').is('deleted_at', null),
      supabase.from('app_settings').select('value').eq('key', 'app_config').single(),
    ]);

    if (eventsErr || catsErr || expErr) throw eventsErr || catsErr || expErr;

    // Extract the settable total budget (0 means use computed sum)
    const appConfig = settingsRow?.value as Record<string, unknown> | null;
    const setTotalBudget = typeof appConfig?.total_budget === 'number' ? appConfig.total_budget : 0;

    // ---- By Event Type ----
    const eventTypes: EventType[] = ['executive', 'national', 'state', 'regional', 'customer'];
    const byEventType = eventTypes.map(type => {
      const eventsOfType = (activeEvents ?? []).filter(e => e.event_type === type);
      const budget = eventsOfType.reduce((sum, e) => sum + (e.budget_amount ?? 0), 0);
      const eventIds = new Set(eventsOfType.map(e => e.id));
      const actual = (activeExpenses ?? [])
        .filter(e => e.event_id && eventIds.has(e.event_id))
        .reduce((sum, e) => sum + e.amount, 0);
      return { type, budget, actual };
    });

    // ---- By Quarter ----
    const quarters: QuarterType[] = ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'];
    const byQuarter = quarters.map(quarter => {
      const eventsInQuarter = (activeEvents ?? []).filter(e => e.quarter === quarter);
      const budget = eventsInQuarter.reduce((sum, e) => sum + (e.budget_amount ?? 0), 0);
      const eventIds = new Set(eventsInQuarter.map(e => e.id));
      const actual = (activeExpenses ?? [])
        .filter(e => e.event_id && eventIds.has(e.event_id))
        .reduce((sum, e) => sum + e.amount, 0);
      return { quarter, budget, actual };
    });

    // ---- By Category ----
    const byCategory = (activeCategories ?? []).map(cat => {
      const actual = (activeExpenses ?? [])
        .filter(e => e.category_id === cat.id)
        .reduce((sum, e) => sum + e.amount, 0);
      return { name: cat.name, budget: cat.budget_amount ?? 0, actual };
    });

    // ---- Totals ----
    const eventsBudget = byEventType.reduce((sum, e) => sum + e.budget, 0);
    const eventsActual = byEventType.reduce((sum, e) => sum + e.actual, 0);
    const categoriesBudget = byCategory.reduce((sum, c) => sum + c.budget, 0);
    const categoriesActual = byCategory.reduce((sum, c) => sum + c.actual, 0);

    const allocatedBudget = eventsBudget + categoriesBudget;
    const totalBudget = setTotalBudget > 0 ? setTotalBudget : allocatedBudget;
    const totalActual = eventsActual + categoriesActual;

    const summary: DashboardSummary = {
      total: {
        budget: totalBudget,
        allocated: allocatedBudget,
        actual: totalActual,
        remaining: totalBudget - totalActual,
      },
      byEventType,
      byQuarter,
      byCategory,
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error('Dashboard summary error:', err);
    logError('Failed to fetch dashboard summary', { error: err as Error, source: 'api/dashboard', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}
