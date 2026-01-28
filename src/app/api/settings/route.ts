/**
 * The Counting House - Settings API
 *
 * Endpoints:
 * GET /api/settings - Get current settings (including custom AI prompts)
 * PUT /api/settings - Update settings (including custom AI prompts)
 * DELETE /api/settings?prompt_key=... - Delete a custom AI prompt (reset to default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

// Settings interface matching our app_config structure
interface AppSettings {
  fiscal_year_id: string;
  openrouter_model: string;
  total_budget: number;
  [key: string]: string | number; // Index signature for Json compatibility
}

// Valid prompt keys stored in app_settings
const PROMPT_KEYS = ['prompt_csv_categorization', 'prompt_pdf_extraction'] as const;
type PromptKey = typeof PROMPT_KEYS[number];

interface PromptValue {
  prompt: string;
}

interface PromptsResponse {
  csv_categorization: string | null;
  pdf_extraction: string | null;
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
            total_budget: 0,
          },
          fiscal_year: null,
          prompts: {
            csv_categorization: null,
            pdf_extraction: null,
          },
        });
      }
      throw settingsError;
    }

    const rawSettings = settingsRow.value as unknown as Partial<AppSettings>;
    const settings: AppSettings = {
      fiscal_year_id: rawSettings.fiscal_year_id || '',
      openrouter_model: rawSettings.openrouter_model || 'anthropic/claude-3-haiku',
      total_budget: typeof rawSettings.total_budget === 'number' ? rawSettings.total_budget : 0,
    };

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

    // Fetch custom AI prompts
    const prompts = await fetchPrompts(supabase);

    return NextResponse.json({
      settings,
      fiscal_year: fiscalYear,
      prompts,
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

    // Validate total_budget if provided
    if (body.total_budget !== undefined) {
      const budget = parseFloat(body.total_budget);
      if (isNaN(budget) || budget < 0) {
        return NextResponse.json(
          { error: 'Invalid total_budget: Must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    // Get current settings first
    const { data: currentRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'app_config')
      .single();

    const rawCurrent = (currentRow?.value as unknown as Partial<AppSettings>) || {};
    const currentSettings: AppSettings = {
      fiscal_year_id: rawCurrent.fiscal_year_id || '',
      openrouter_model: rawCurrent.openrouter_model || 'anthropic/claude-3-haiku',
      total_budget: typeof rawCurrent.total_budget === 'number' ? rawCurrent.total_budget : 0,
    };

    // Build updated settings
    const updatedSettings: AppSettings = {
      fiscal_year_id: body.fiscal_year_id ?? currentSettings.fiscal_year_id,
      openrouter_model: body.openrouter_model ?? currentSettings.openrouter_model,
      total_budget: body.total_budget !== undefined ? parseFloat(body.total_budget) : currentSettings.total_budget,
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

    // Handle prompt upserts/deletes if provided
    if (body.prompts) {
      const promptMap: Record<string, PromptKey> = {
        csv_categorization: 'prompt_csv_categorization',
        pdf_extraction: 'prompt_pdf_extraction',
      };

      for (const [shortKey, dbKey] of Object.entries(promptMap)) {
        if (!(shortKey in body.prompts)) continue;

        const value = body.prompts[shortKey];

        if (value && typeof value === 'string' && value.trim().length > 0) {
          // Upsert the prompt
          const { error: promptError } = await supabase
            .from('app_settings')
            .upsert({
              key: dbKey,
              value: { prompt: value.trim() } as unknown as Json,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'key',
            });

          if (promptError) {
            console.error(`Prompt upsert error for ${dbKey}:`, promptError);
          }
        } else {
          // Delete the prompt row (reset to default)
          await supabase
            .from('app_settings')
            .delete()
            .eq('key', dbKey);
        }
      }
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

    // Fetch updated prompts
    const prompts = await fetchPrompts(supabase);

    return NextResponse.json({
      settings: updatedSettings,
      fiscal_year: fiscalYear,
      prompts,
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

// ============================================
// DELETE /api/settings?prompt_key=...
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promptKey = searchParams.get('prompt_key');

    if (!promptKey || !PROMPT_KEYS.includes(promptKey as PromptKey)) {
      return NextResponse.json(
        { error: `Invalid prompt_key. Must be one of: ${PROMPT_KEYS.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('app_settings')
      .delete()
      .eq('key', promptKey);

    if (error) {
      console.error('Prompt delete error:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete prompt error:', error);
    return NextResponse.json(
      { error: 'Failed to delete prompt' },
      { status: 500 }
    );
  }
}

// ============================================
// Helper: Fetch custom AI prompts
// ============================================

async function fetchPrompts(supabase: Awaited<ReturnType<typeof createClient>>): Promise<PromptsResponse> {
  const { data: promptRows } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', [...PROMPT_KEYS]);

  const prompts: PromptsResponse = {
    csv_categorization: null,
    pdf_extraction: null,
  };

  if (promptRows) {
    for (const row of promptRows) {
      const val = row.value as unknown as PromptValue | null;
      const promptText = val?.prompt || null;

      if (row.key === 'prompt_csv_categorization') {
        prompts.csv_categorization = promptText;
      } else if (row.key === 'prompt_pdf_extraction') {
        prompts.pdf_extraction = promptText;
      }
    }
  }

  return prompts;
}
