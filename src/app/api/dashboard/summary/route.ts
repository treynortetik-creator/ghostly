/**
 * The Counting House - Dashboard Summary API
 * Returns budget vs actual data for the main dashboard
 *
 * Endpoints:
 * GET /api/dashboard/summary - Returns dashboard summary data
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import type { EventType, QuarterType } from '@/types/database';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface DashboardSummary {
  total: {
    budget: number;
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
// MOCK DATA (Based on seed.sql)
// Will be replaced with real Supabase queries
// ============================================

// Event budgets by type from seed data
const mockEventsByType: Record<EventType, { budget: number; actual: number }> = {
  executive: {
    // 12 events: 16500+30500+65000+40000+8700+5000+35000+8000+50000+7500+35000+38000 = 339,200
    budget: 339200,
    actual: 125000, // ~37% spent
  },
  national: {
    // 19 events: 25000+48000+1700+2200+2500+800+12500+1500+80000+1500+1000+5000+5000+5000+18000+30000+15000+1200+10000 = 265,900
    budget: 265900,
    actual: 98500, // ~37% spent
  },
  state: {
    // 13 events: 1200+4000+1300+11000+300+4000+4600+8000+1200+10000+500+10000+60000 = 116,100
    budget: 116100,
    actual: 45200, // ~39% spent
  },
  regional: {
    // No regional events in seed data
    budget: 0,
    actual: 0,
  },
  customer: {
    // 1 event: 150,000
    budget: 150000,
    actual: 18750, // ~12.5% spent
  },
};

// Quarter budgets from seed data
const mockByQuarter: Record<QuarterType, { budget: number; actual: number }> = {
  Q1: {
    // Executive Q1: 16500+30500+65000+40000 = 152,000
    // National Q1: 1700+2200+2500+800 = 7,200
    // State Q1: 1200 = 1,200
    // Total: 160,400
    budget: 160400,
    actual: 85200, // ~53% spent (Q1 mostly complete)
  },
  Q2: {
    // Executive Q2: 8700+5000+35000+8000 = 56,700
    // National Q2: 12500+1500+80000+1500+10000 = 105,500
    // State Q2: 4000+1300+11000+300 = 16,600
    // Total: 178,800
    budget: 178800,
    actual: 92450, // ~52% spent
  },
  Q3: {
    // Executive Q3: 50000 = 50,000
    // National Q3: 1000+5000+5000 = 11,000
    // State Q3: 4000+4600+8000+1200 = 17,800
    // Total: 78,800
    budget: 78800,
    actual: 25600, // ~32% spent
  },
  Q4: {
    // Executive Q4: 7500+35000+38000 = 80,500
    // National Q4: 5000+18000+30000+15000+1200 = 69,200
    // State Q4: 10000+500+10000 = 20,500
    // Total: 170,200
    budget: 170200,
    actual: 45200, // ~27% spent
  },
  TBD: {
    // National TBD: 25000+48000 = 73,000
    // State TBD: 60000 = 60,000
    // Customer TBD: 150000 = 150,000
    // Total: 283,000
    budget: 283000,
    actual: 39000, // ~14% allocated
  },
};

// Budget categories from seed data
const mockCategories = [
  { name: 'Spare Funds', budget: 30000, actual: 8500 },
  { name: 'Exhibit Properties', budget: 15000, actual: 12200 },
  { name: 'Swag', budget: 14000, actual: 7800 },
  { name: 'Marketing Expenses', budget: 5000, actual: 2100 },
  { name: 'Conference Cost Increase', budget: 50000, actual: 0 },
];

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

    // TODO: Replace with real Supabase queries when connected
    // const supabase = await createClient();
    //
    // const [eventsResult, categoriesResult, expensesResult] = await Promise.all([
    //   supabase.from('events').select('*').is('deleted_at', null),
    //   supabase.from('budget_categories').select('*').is('deleted_at', null),
    //   supabase.from('expenses').select('*').is('deleted_at', null).eq('is_duplicate', false),
    // ]);

    // Calculate totals
    const eventsBudget = Object.values(mockEventsByType).reduce((sum, e) => sum + e.budget, 0);
    const eventsActual = Object.values(mockEventsByType).reduce((sum, e) => sum + e.actual, 0);
    const categoriesBudget = mockCategories.reduce((sum, c) => sum + c.budget, 0);
    const categoriesActual = mockCategories.reduce((sum, c) => sum + c.actual, 0);

    const totalBudget = eventsBudget + categoriesBudget;
    const totalActual = eventsActual + categoriesActual;

    // Build response
    const summary: DashboardSummary = {
      total: {
        budget: totalBudget,
        actual: totalActual,
        remaining: totalBudget - totalActual,
      },
      byEventType: [
        { type: 'executive', ...mockEventsByType.executive },
        { type: 'national', ...mockEventsByType.national },
        { type: 'state', ...mockEventsByType.state },
        { type: 'regional', ...mockEventsByType.regional },
        { type: 'customer', ...mockEventsByType.customer },
      ],
      byQuarter: [
        { quarter: 'Q1', ...mockByQuarter.Q1 },
        { quarter: 'Q2', ...mockByQuarter.Q2 },
        { quarter: 'Q3', ...mockByQuarter.Q3 },
        { quarter: 'Q4', ...mockByQuarter.Q4 },
        { quarter: 'TBD', ...mockByQuarter.TBD },
      ],
      byCategory: mockCategories,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}
