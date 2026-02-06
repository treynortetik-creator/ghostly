/**
 * The Counting House - Fiscal Years API
 *
 * Endpoints:
 * GET /api/fiscal-years - List all fiscal years
 * POST /api/fiscal-years - Create a new fiscal year
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';
import { logError } from '@/lib/error-logger';
import { logAudit, getActor } from '@/lib/audit';

// ============================================
// GET /api/fiscal-years
// ============================================

export async function GET(request: NextRequest) {
  const denied = requirePermission(request, 'read');
  if (denied) return denied;

  try {
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
  } catch (error) {
    console.error('Fiscal years API error:', error);
    logError('Failed to fetch fiscal years', { error: error as Error, source: 'api/fiscal-years', context: { method: 'GET' } });
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
  const deniedPost = requirePermission(request, 'write');
  if (deniedPost) return deniedPost;

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

    // Audit log (non-blocking)
    try {
      const { actor, actor_type } = await getActor(request);
      logAudit({ entity_type: 'event', entity_id: newFiscalYear.id, action: 'create', changes: null, actor, actor_type, metadata: { sub_type: 'fiscal_year', year } });
    } catch (e) { console.error('Audit log failed:', e); }

    return NextResponse.json(newFiscalYear, { status: 201 });
  } catch (error) {
    console.error('Create fiscal year error:', error);
    logError('Failed to create fiscal year', { error: error as Error, source: 'api/fiscal-years', context: { method: 'POST' } });
    return NextResponse.json(
      { error: 'Failed to create fiscal year' },
      { status: 500 }
    );
  }
}
