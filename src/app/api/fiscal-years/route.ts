/**
 * Ghostly - Fiscal Years API
 *
 * Endpoints:
 * GET /api/fiscal-years - List all fiscal years
 * POST /api/fiscal-years - Create a new fiscal year
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';

// ============================================
// GET /api/fiscal-years
// ============================================

export const GET = withApiHandler({ permission: 'read', resource: 'fiscal-years' },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const modifiedAfter = searchParams.get('modified_after');

    // Validate modified_after if provided
    if (modifiedAfter && isNaN(Date.parse(modifiedAfter))) {
      return NextResponse.json(
        { error: 'Invalid modified_after. Must be a valid ISO 8601 timestamp.' },
        { status: 400 }
      );
    }

    const filters: { modified_after?: string } = {};
    if (modifiedAfter) {
      filters.modified_after = modifiedAfter;
    }

    const supabase = await createClient();

    let query = supabase
      .from('fiscal_years')
      .select('*');

    if (filters.modified_after) query = query.gt('updated_at', filters.modified_after);

    const { data: fiscalYears, error } = await query.order('year', { ascending: false });

    if (error) {
      console.error('Fiscal years fetch error:', error);
      throw error;
    }

    return NextResponse.json({
      fiscal_years: fiscalYears || [],
      meta: {
        total: fiscalYears?.length || 0,
        filters_applied: filters,
      },
    });
  }
);

// ============================================
// POST /api/fiscal-years
// ============================================

export const POST = withApiHandler({ permission: 'write', resource: 'fiscal-years' },
  async (request: NextRequest) => {
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

    // Audit log (non-blocking)
    await auditMutation(request, { entity_type: 'event', entity_id: newFiscalYear.id, action: 'create', changes: null, metadata: { sub_type: 'fiscal_year', year } });

    return NextResponse.json(newFiscalYear, { status: 201 });
  }
);
