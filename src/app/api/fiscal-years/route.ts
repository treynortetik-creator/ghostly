/**
 * The Counting House - Fiscal Years API
 *
 * Endpoints:
 * GET /api/fiscal-years - List all fiscal years
 * POST /api/fiscal-years - Create a new fiscal year
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================
// GET /api/fiscal-years
// ============================================

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: fiscalYears, error } = await supabase
      .from('fiscal_years')
      .select('*')
      .order('year', { ascending: false });

    if (error) {
      console.error('Fiscal years fetch error:', error);
      throw error;
    }

    return NextResponse.json({
      fiscal_years: fiscalYears || [],
      meta: {
        total: fiscalYears?.length || 0,
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
    const supabase = await createClient();

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
    const { data: existing } = await supabase
      .from('fiscal_years')
      .select('id')
      .eq('year', year)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: `Fiscal year ${year} already exists` },
        { status: 409 }
      );
    }

    // Insert new fiscal year
    const { data: newFiscalYear, error: insertError } = await supabase
      .from('fiscal_years')
      .insert({ year })
      .select()
      .single();

    if (insertError) {
      console.error('Fiscal year insert error:', insertError);
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: `Fiscal year ${year} already exists` },
          { status: 409 }
        );
      }
      throw insertError;
    }

    return NextResponse.json(newFiscalYear, { status: 201 });
  } catch (error) {
    console.error('Create fiscal year error:', error);
    return NextResponse.json(
      { error: 'Failed to create fiscal year' },
      { status: 500 }
    );
  }
}
