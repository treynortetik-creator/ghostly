/**
 * The Counting House - Settings API
 *
 * Endpoints:
 * GET /api/settings - Get current settings
 * PUT /api/settings - Update settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings, getFiscalYearById, type Settings } from '@/lib/mock-data/settings';

// ============================================
// GET /api/settings
// ============================================

export async function GET() {
  try {
    // TODO: Replace with real Supabase queries when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase.from('app_settings').select('*').single();

    const settings = getSettings();
    const fiscalYear = getFiscalYearById(settings.fiscal_year_id);

    return NextResponse.json({
      settings,
      fiscal_year: fiscalYear || null,
    });
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT /api/settings
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate fiscal_year_id if provided
    if (body.fiscal_year_id) {
      const fiscalYear = getFiscalYearById(body.fiscal_year_id);
      if (!fiscalYear) {
        return NextResponse.json(
          { error: 'Invalid fiscal_year_id: Fiscal year not found' },
          { status: 400 }
        );
      }
    }

    // Validate openrouter_model if provided (basic validation)
    if (body.openrouter_model !== undefined && typeof body.openrouter_model !== 'string') {
      return NextResponse.json(
        { error: 'Invalid openrouter_model: Must be a string' },
        { status: 400 }
      );
    }

    // TODO: Replace with real Supabase update when connected
    // const supabase = await createClient();
    // const { data, error } = await supabase.from('app_settings').update(updates).select().single();

    const updates: Partial<Settings> = {};
    if (body.fiscal_year_id) updates.fiscal_year_id = body.fiscal_year_id;
    if (body.openrouter_model !== undefined) updates.openrouter_model = body.openrouter_model;

    const updatedSettings = updateSettings(updates);
    const fiscalYear = getFiscalYearById(updatedSettings.fiscal_year_id);

    return NextResponse.json({
      settings: updatedSettings,
      fiscal_year: fiscalYear || null,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
