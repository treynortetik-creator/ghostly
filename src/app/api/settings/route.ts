/**
 * Ghostly - Settings API
 *
 * Endpoints:
 * GET /api/settings - Get current settings (including custom AI prompts)
 * PUT /api/settings - Update settings (including custom AI prompts)
 * DELETE /api/settings?prompt_key=... - Delete a custom AI prompt (reset to default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import type { AuditEntityType } from '@/lib/audit';
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
// Configurable org settings keys
// ============================================

/** Keys for JSONB settings stored as separate app_settings rows */
const ORG_CONFIG_KEYS = [
  'checklist_phases',
  'note_types',
  'saved_filters',
] as const;
type OrgConfigKey = typeof ORG_CONFIG_KEYS[number];

/** Default checklist phases */
const DEFAULT_CHECKLIST_PHASES = [
  { id: 'pre_event', label: 'Pre-Event', sort_order: 0 },
  { id: 'day_of', label: 'Day Of', sort_order: 1 },
  { id: 'post_event', label: 'Post-Event', sort_order: 2 },
];

/** Default note types */
const DEFAULT_NOTE_TYPES = [
  { id: 'general', label: 'General', sort_order: 0 },
  { id: 'competitor_alert', label: 'Competitor Alert', sort_order: 1 },
  { id: 'logistics', label: 'Logistics', sort_order: 2 },
  { id: 'budget', label: 'Budget', sort_order: 3 },
  { id: 'post_event', label: 'Post-Event', sort_order: 4 },
];

// ============================================
// GET /api/settings
// ============================================

export const GET = withApiHandler({ permission: 'admin', resource: 'settings' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    // Fetch app config from app_settings table
    const { data: settingsRow, error: settingsError } = await supabase
      .from('app_settings')
      .select('*')
      .eq('organization_id', orgId)
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

    // Fetch custom AI prompts and org configs in parallel
    const [prompts, orgConfigs] = await Promise.all([
      fetchPrompts(supabase, orgId),
      fetchOrgConfigs(supabase, orgId),
    ]);

    return NextResponse.json({
      settings,
      fiscal_year: fiscalYear,
      prompts,
      checklist_phases: orgConfigs.checklist_phases || DEFAULT_CHECKLIST_PHASES,
      note_types: orgConfigs.note_types || DEFAULT_NOTE_TYPES,
      saved_filters: orgConfigs.saved_filters || [],
    });
  }
);

// ============================================
// PUT /api/settings
// ============================================

export const PUT = withApiHandler({ permission: 'admin', resource: 'settings' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
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
      .eq('organization_id', orgId)
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
        organization_id: orgId,
        key: 'app_config',
        value: updatedSettings as Json,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,key',
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
              organization_id: orgId,
              key: dbKey,
              value: { prompt: value.trim() } as unknown as Json,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,key',
            });

          if (promptError) {
            console.error(`Prompt upsert error for ${dbKey}:`, promptError);
          }
        } else {
          // Delete the prompt row (reset to default)
          await supabase
            .from('app_settings')
            .delete()
            .eq('organization_id', orgId)
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

    // Handle org config updates (checklist_phases, note_types, saved_filters)
    for (const key of ORG_CONFIG_KEYS) {
      if (body[key] !== undefined) {
        if (body[key] === null) {
          // Delete (reset to default)
          await supabase
            .from('app_settings')
            .delete()
            .eq('organization_id', orgId)
            .eq('key', key);
        } else {
          // Upsert the config
          const { error: configError } = await supabase
            .from('app_settings')
            .upsert({
              organization_id: orgId,
              key,
              value: body[key] as unknown as Json,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'organization_id,key',
            });

          if (configError) {
            console.error(`Config upsert error for ${key}:`, configError);
          }
        }
      }
    }

    // Fetch updated prompts and org configs
    const [prompts, orgConfigs] = await Promise.all([
      fetchPrompts(supabase, orgId),
      fetchOrgConfigs(supabase, orgId),
    ]);

    // Audit log
    await auditMutation(request, {
      entity_type: 'event' as AuditEntityType,
      entity_id: 'app_config',
      action: 'update',
      changes: null,
      metadata: { sub_type: 'settings' },
    });

    return NextResponse.json({
      settings: updatedSettings,
      fiscal_year: fiscalYear,
      prompts,
      checklist_phases: orgConfigs.checklist_phases || DEFAULT_CHECKLIST_PHASES,
      note_types: orgConfigs.note_types || DEFAULT_NOTE_TYPES,
      saved_filters: orgConfigs.saved_filters || [],
      message: 'Settings updated successfully',
    });
  }
);

// ============================================
// DELETE /api/settings?prompt_key=...
// ============================================

export const DELETE = withApiHandler({ permission: 'admin', resource: 'settings' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
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
      .eq('organization_id', orgId)
      .eq('key', promptKey);

    if (error) {
      console.error('Prompt delete error:', error);
      throw error;
    }

    // Audit log
    await auditMutation(request, {
      entity_type: 'event' as AuditEntityType,
      entity_id: promptKey,
      action: 'delete',
      changes: null,
      metadata: { sub_type: 'settings_prompt' },
    });

    return NextResponse.json({ success: true });
  }
);

// ============================================
// Helper: Fetch custom AI prompts
// ============================================

async function fetchPrompts(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<PromptsResponse> {
  const { data: promptRows } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('organization_id', orgId)
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

// ============================================
// Helper: Fetch org config settings
// ============================================

interface OrgConfigs {
  checklist_phases: unknown[] | null;
  note_types: unknown[] | null;
  saved_filters: unknown[] | null;
}

async function fetchOrgConfigs(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<OrgConfigs> {
  const { data: rows } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('organization_id', orgId)
    .in('key', [...ORG_CONFIG_KEYS]);

  const configs: OrgConfigs = {
    checklist_phases: null,
    note_types: null,
    saved_filters: null,
  };

  if (rows) {
    for (const row of rows) {
      const key = row.key as OrgConfigKey;
      if (key in configs) {
        configs[key] = row.value as unknown[] | null;
      }
    }
  }

  return configs;
}
