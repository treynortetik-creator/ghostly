/**
 * The Counting House - Settings API
 *
 * Endpoints:
 * GET /api/settings - Get current settings
 * PUT /api/settings - Update settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

// Settings interface matching our app_config structure
interface AppSettings {
  fiscal_year_id: string;
  openrouter_model: string;
  [key: string]: string; // Index signature for Json compatibility
}

// ============================================
// GET /api/settings
// ============================================

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch app config from app_settings table
    const { data: settingsRow, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'app_config')
      .single();

    if (settingsError) {
      console.error('Settings fetch error:', settingsError);
      // Return default settings if not found
      if (settingsError.code === 'PGRST116') {
        return NextResponse.json({
          settings: {
            fiscal_year_id: '',
            openrouter_model: 'anthropic/claude-3-haiku',
          },
          fiscal_year: null,
        });
      }
      throw settingsError;
    }

    const settings = settingsRow.value as unknown as AppSettings;

    // Fetch the fiscal year details if we have one
    let fiscalYear = null;
    if (settings.fiscal_year_id) {
      const { data: fyData } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', settings.fiscal_year_id)
        .single();
      fiscalYear = fyData;
    }

    return NextResponse.json({
      settings,
      fiscal_year: fiscalYear,
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
    const supabase = await createClient();

    // Validate fiscal_year_id if provided
    if (body.fiscal_year_id) {
      const { data: fyData, error: fyError } = await supabase
        .from('fiscal_years')
        .select('id')
        .eq('id', body.fiscal_year_id)
        .single();

      if (fyError || !fyData) {
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

    // Get current settings first
    const { data: currentRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_config')
      .single();

    const currentSettings = (currentRow?.value as unknown as AppSettings) || {
      fiscal_year_id: '',
      openrouter_model: 'anthropic/claude-3-haiku',
    };

    // Build updated settings
    const updatedSettings: AppSettings = {
      fiscal_year_id: body.fiscal_year_id ?? currentSettings.fiscal_year_id,
      openrouter_model: body.openrouter_model ?? currentSettings.openrouter_model,
    };

    // Upsert the settings
    const { error: updateError } = await supabase
      .from('app_settings')
      .upsert({
        key: 'app_config',
        value: updatedSettings as Json,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });

    if (updateError) {
      console.error('Settings update error:', updateError);
      throw updateError;
    }

    // Fetch the fiscal year details if we have one
    let fiscalYear = null;
    if (updatedSettings.fiscal_year_id) {
      const { data: fyData } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('id', updatedSettings.fiscal_year_id)
        .single();
      fiscalYear = fyData;
    }

    return NextResponse.json({
      settings: updatedSettings,
      fiscal_year: fiscalYear,
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
