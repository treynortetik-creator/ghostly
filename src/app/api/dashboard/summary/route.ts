/**
 * The Counting House - Dashboard Summary API
 * Returns budget vs actual data for the main dashboard
 *
 * Endpoints:
 * GET /api/dashboard/summary - Returns dashboard summary data
 */

import { NextResponse } from 'next/server';
import { logError } from '@/lib/error-logger';
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
  fiscalYear: { id: string; year: number } | null;
}

// ============================================
// API HANDLER
// ============================================

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch settings to determine fiscal year
    const { data: settingsRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_config')
      .single();

    const appConfig = settingsRow?.value as Record<string, unknown> | null;
    const setTotalBudget = typeof appConfig?.total_budget === 'number' ? appConfig.total_budget : 0;
    let fiscalYearId = (appConfig?.fiscal_year_id as string) || '';

    // If no fiscal year configured, default to current calendar year
    let fiscalYearInfo: { id: string; year: number } | null = null;
    if (fiscalYearId) {
      const { data: fy } = await supabase
        .from('fiscal_years')
        .select('id, year')
        .eq('id', fiscalYearId)
        .single();
      if (fy) {
        fiscalYearInfo = fy;
      } else {
        fiscalYearId = '';
      }
    }

    if (!fiscalYearId) {
      const currentYear = new Date().getFullYear();
      const { data: fy } = await supabase
        .from('fiscal_years')
        .select('id, year')
        .eq('year', currentYear)
        .single();
      if (fy) {
        fiscalYearId = fy.id;
        fiscalYearInfo = fy;
      }
    }

    // Build queries filtered by fiscal year
    let eventsQuery = supabase.from('events').select('*').is('deleted_at', null);
    let categoriesQuery = supabase.from('budget_categories').select('*').is('deleted_at', null);

    if (fiscalYearId) {
      eventsQuery = eventsQuery.eq('fiscal_year_id', fiscalYearId);
      categoriesQuery = categoriesQuery.eq('fiscal_year_id', fiscalYearId);
    }

    const [
      { data: activeEvents, error: eventsErr },
      { data: activeCategories, error: catsErr },
      { data: activeExpenses, error: expErr },
    ] = await Promise.all([
      eventsQuery,
      categoriesQuery,
      supabase.from('expenses').select('*').is('deleted_at', null),
    ]);

    if (eventsErr || catsErr || expErr) throw eventsErr || catsErr || expErr;

    // Build sets of valid event/category IDs for expense filtering
    const validEventIds = new Set((activeEvents ?? []).map(e => e.id));
    const validCategoryIds = new Set((activeCategories ?? []).map(c => c.id));

    // Filter expenses to only those belonging to fiscal-year-scoped events/categories
    const scopedExpenses = (activeExpenses ?? []).filter(e =>
      (e.event_id && validEventIds.has(e.event_id)) ||
      (e.category_id && validCategoryIds.has(e.category_id))
    );

    // ---- By Event Type ----
    const eventTypes: EventType[] = ['executive', 'national', 'state', 'regional', 'customer'];
    const byEventType = eventTypes.map(type => {
      const eventsOfType = (activeEvents ?? []).filter(e => e.event_type === type);
      const budget = eventsOfType.reduce((sum, e) => sum + (e.budget_amount ?? 0), 0);
      const eventIds = new Set(eventsOfType.map(e => e.id));
      const actual = scopedExpenses
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
      const actual = scopedExpenses
        .filter(e => e.event_id && eventIds.has(e.event_id))
        .reduce((sum, e) => sum + e.amount, 0);
      return { quarter, budget, actual };
    });

    // ---- By Category ----
    const byCategory = (activeCategories ?? []).map(cat => {
      const actual = scopedExpenses
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
      fiscalYear: fiscalYearInfo,
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
