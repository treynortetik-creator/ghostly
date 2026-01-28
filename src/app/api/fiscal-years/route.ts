/**
 * The Counting House - Fiscal Years API
 *
 * Endpoints:
 * GET /api/fiscal-years - List all fiscal years
 * POST /api/fiscal-years - Create a new fiscal year
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFiscalYears, createFiscalYear, mockFiscalYears } from '@/lib/mock-data/settings';

// ============================================
// GET /api/fiscal-years
// ============================================

export async function GET() {
  try {
    // TODO: Replace with real Supabase queries when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase.from('fiscal_years').select('*').order('year', { ascending: false });

    const fiscalYears = getFiscalYears();

    return NextResponse.json({
      fiscal_years: fiscalYears,
      meta: {
        total: fiscalYears.length,
      },
    });
  } catch (error) {
    console.error('Fiscal years API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fiscal years' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/fiscal-years
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required field
    if (!body.year) {
      return NextResponse.json(
        { error: 'Missing required field: year' },
        { status: 400 }
      );
    }

    // Validate year is a valid number
    const year = parseInt(body.year, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Invalid year: Must be a number between 2000 and 2100' },
        { status: 400 }
      );
    }

    // Check if fiscal year already exists
    const existing = mockFiscalYears.find(fy => fy.year === year);
    if (existing) {
      return NextResponse.json(
        { error: `Fiscal year ${year} already exists` },
        { status: 409 }
      );
    }

    // TODO: Replace with real Supabase insert when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase.from('fiscal_years').insert({ year }).select().single();

    const newFiscalYear = createFiscalYear(year);

    return NextResponse.json(newFiscalYear, { status: 201 });
  } catch (error) {
    console.error('Create fiscal year error:', error);
    return NextResponse.json(
      { error: 'Failed to create fiscal year' },
      { status: 500 }
    );
  }
}
