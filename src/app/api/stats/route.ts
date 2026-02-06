/**
 * The Counting House - Stats API
 *
 * Endpoints:
 * GET /api/stats - Global statistics for the active fiscal year
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

// ============================================
// GET /api/stats
// ============================================

export async function GET(request: NextRequest) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
    const supabase = await createClient();

    // Get active fiscal year from app_settings
    const { data: settingsRow, error: settingsError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_config')
      .single();

    if (settingsError) {
      if (settingsError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'No app settings configured. Set an active fiscal year first.' },
          { status: 404 }
        );
      }
      throw settingsError;
    }

    const settings = settingsRow.value as unknown as { fiscal_year_id?: string };
    const fiscalYearId = settings.fiscal_year_id;

    if (!fiscalYearId) {
      return NextResponse.json(
        { error: 'No active fiscal year configured.' },
        { status: 404 }
      );
    }

    // Fetch all data in parallel
    const [
      eventsResult,
      expensesResult,
      teamMembersResult,
      categoryExpensesResult,
    ] = await Promise.all([
      // Events for this fiscal year
      supabase
        .from('events')
        .select('id, budget_amount, quarter')
        .eq('fiscal_year_id', fiscalYearId)
        .is('deleted_at', null),
      // Expenses tied to events in this fiscal year
      supabase
        .from('expenses')
        .select('event_id, category_id, amount, vendor')
        .not('event_id', 'is', null)
        .is('deleted_at', null),
      // All active team members
      supabase
        .from('team_members')
        .select('id', { count: 'exact' })
        .is('deleted_at', null),
      // Expenses tied to budget categories in this fiscal year
      supabase
        .from('expenses')
        .select('category_id, amount, vendor')
        .not('category_id', 'is', null)
        .is('deleted_at', null),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (expensesResult.error) throw expensesResult.error;
    if (teamMembersResult.error) throw teamMembersResult.error;
    if (categoryExpensesResult.error) throw categoryExpensesResult.error;

    const events = eventsResult.data || [];
    const allEventExpenses = expensesResult.data || [];
    const allCategoryExpenses = categoryExpensesResult.data || [];

    // Build set of event IDs in this fiscal year for filtering expenses
    const fiscalEventIds = new Set(events.map(e => e.id));

    // Get budget category IDs for this fiscal year
    const { data: fiscalCategories } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('fiscal_year_id', fiscalYearId)
      .is('deleted_at', null);

    const fiscalCategoryIds = new Set((fiscalCategories || []).map(c => c.id));

    // Filter expenses to only those belonging to fiscal year events/categories
    const fiscalEventExpenses = allEventExpenses.filter(e => e.event_id && fiscalEventIds.has(e.event_id));
    const fiscalCategoryExpenses = allCategoryExpenses.filter(e => e.category_id && fiscalCategoryIds.has(e.category_id));
    const fiscalExpenses = [...fiscalEventExpenses, ...fiscalCategoryExpenses];

    // Total counts
    const totalEvents = events.length;
    const totalExpenses = fiscalExpenses.length;
    const totalTeamMembers = teamMembersResult.count ?? 0;

    // Budget and spend
    const totalBudget = events.reduce((sum, e) => sum + (e.budget_amount ?? 0), 0);
    const totalSpent = fiscalExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalRemaining = totalBudget - totalSpent;
    const budgetUtilizationPct = totalBudget > 0
      ? Math.round((totalSpent / totalBudget) * 10000) / 100
      : 0;

    // Events by quarter
    const eventsByQuarter: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, TBD: 0 };
    for (const event of events) {
      const q = event.quarter || 'TBD';
      if (q in eventsByQuarter) {
        eventsByQuarter[q]++;
      } else {
        eventsByQuarter['TBD']++;
      }
    }

    // Top vendors by total spend
    const vendorMap = new Map<string, { total: number; count: number }>();
    for (const expense of fiscalExpenses) {
      const vendor = expense.vendor?.trim();
      if (!vendor) continue;
      const prev = vendorMap.get(vendor) || { total: 0, count: 0 };
      vendorMap.set(vendor, { total: prev.total + expense.amount, count: prev.count + 1 });
    }

    const topVendors = Array.from(vendorMap.entries())
      .map(([vendor, stats]) => ({
        vendor,
        total: Math.round(stats.total * 100) / 100,
        count: stats.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return NextResponse.json({
      fiscal_year_id: fiscalYearId,
      total_events: totalEvents,
      total_expenses: totalExpenses,
      total_team_members: totalTeamMembers,
      total_budget: Math.round(totalBudget * 100) / 100,
      total_spent: Math.round(totalSpent * 100) / 100,
      total_remaining: Math.round(totalRemaining * 100) / 100,
      budget_utilization_pct: budgetUtilizationPct,
      events_by_quarter: eventsByQuarter,
      top_vendors: topVendors,
    });
  } catch (err) {
    console.error('Stats API error:', err);
    logError('Failed to fetch stats', { error: err as Error, source: 'api/stats', context: { method: 'GET' } });
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
