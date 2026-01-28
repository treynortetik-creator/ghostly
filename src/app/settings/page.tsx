'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Settings, Save, RefreshCw, CheckCircle, AlertCircle, DollarSign, Calendar, FolderOpen, Bot } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import { FiscalYearSelector, ModelSelector, PromptEditor } from '@/components/settings';
import { DEFAULT_CSV_PROMPT, DEFAULT_PDF_PROMPT } from '@/lib/openrouter';
import type { FiscalYear } from '@/types/database';

/* ============================================
   SETTINGS PAGE
   ============================================
   Application configuration page for managing
   fiscal years and AI model selection.
   Victorian theme: "The Configuration Chambers"
   ============================================ */

interface SettingsData {
  fiscal_year_id: string;
  openrouter_model: string;
  total_budget: string;
}

interface SettingsApiResponse {
  settings: {
    fiscal_year_id: string;
    openrouter_model: string;
    total_budget: number;
  };
  fiscal_year: FiscalYear | null;
  prompts?: { csv_categorization: string | null; pdf_extraction: string | null };
}

interface BudgetSummary {
  eventsBudget: number;
  eventsCount: number;
  categoriesBudget: number;
  categoriesCount: number;
  totalBudget: number;
}

export default function SettingsPage() {
  // Settings state
  const [settings, setSettings] = useState<SettingsData>({
    fiscal_year_id: '',
    openrouter_model: 'anthropic/claude-3-haiku',
    total_budget: '0',
  });
  const [originalSettings, setOriginalSettings] = useState<SettingsData | null>(null);
  const [prompts, setPrompts] = useState<{ csv_categorization: string | null; pdf_extraction: string | null }>({
    csv_categorization: null,
    pdf_extraction: null,
  });
  const [originalPrompts, setOriginalPrompts] = useState<typeof prompts | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if settings have changed
  const hasChanges = originalSettings && (
    settings.fiscal_year_id !== originalSettings.fiscal_year_id ||
    settings.openrouter_model !== originalSettings.openrouter_model ||
    settings.total_budget !== originalSettings.total_budget ||
    prompts.csv_categorization !== originalPrompts?.csv_categorization ||
    prompts.pdf_extraction !== originalPrompts?.pdf_extraction
  );

  // Fetch current settings and budget summary
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Fetch settings, events, and categories in parallel
      const [settingsRes, eventsRes, categoriesRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/events'),
        fetch('/api/categories'),
      ]);

      if (!settingsRes.ok) throw new Error('Failed to fetch settings');

      const data: SettingsApiResponse = await settingsRes.json();
      const fetchedSettings: SettingsData = {
        fiscal_year_id: data.settings.fiscal_year_id,
        openrouter_model: data.settings.openrouter_model,
        total_budget: (data.settings.total_budget ?? 0).toString(),
      };
      setSettings(fetchedSettings);
      setOriginalSettings(fetchedSettings);

      const fetchedPrompts = data.prompts || { csv_categorization: null, pdf_extraction: null };
      setPrompts(fetchedPrompts);
      setOriginalPrompts(fetchedPrompts);

      // Calculate budget summary
      if (eventsRes.ok && categoriesRes.ok) {
        const eventsData = await eventsRes.json();
        const categoriesData = await categoriesRes.json();

        const eventsBudget = eventsData.events?.reduce((sum: number, e: { budget_amount: number }) => sum + (e.budget_amount || 0), 0) || 0;
        const categoriesBudget = categoriesData.categories?.reduce((sum: number, c: { budget_amount: number }) => sum + (c.budget_amount || 0), 0) || 0;

        setBudgetSummary({
          eventsBudget,
          eventsCount: eventsData.events?.length || 0,
          categoriesBudget,
          categoriesCount: categoriesData.categories?.length || 0,
          totalBudget: eventsBudget + categoriesBudget,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle save settings
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiscal_year_id: settings.fiscal_year_id,
          openrouter_model: settings.openrouter_model,
          total_budget: parseFloat(settings.total_budget) || 0,
          prompts,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      const data = await response.json();
      const updatedSettings: SettingsData = {
        fiscal_year_id: data.settings.fiscal_year_id,
        openrouter_model: data.settings.openrouter_model,
        total_budget: (data.settings.total_budget ?? 0).toString(),
      };
      setSettings(updatedSettings);
      setOriginalSettings(updatedSettings);

      const updatedPrompts = data.prompts || { csv_categorization: null, pdf_extraction: null };
      setPrompts(updatedPrompts);
      setOriginalPrompts(updatedPrompts);

      setSuccessMessage('Settings saved successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset changes
  const handleReset = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      if (originalPrompts) setPrompts(originalPrompts);
      setError(null);
      setSuccessMessage(null);
    }
  };

  // Format date for header
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-wood-dark flex items-center gap-3">
            <Settings className="w-8 h-8 text-ink-gold" />
            The Configuration Chambers
          </h1>
          <p className="mt-1 text-sepia">
            Application Settings &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchSettings}
            disabled={isLoading || isSaving}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-ink-gold animate-spin mx-auto mb-3" />
            <p className="text-sepia">Loading settings...</p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-ink-red/10 border border-ink-red/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-ink-red flex-shrink-0" />
              <p className="text-ink-red">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-3 p-4 bg-ink-green/10 border border-ink-green/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-ink-green flex-shrink-0" />
              <p className="text-ink-green">{successMessage}</p>
            </div>
          )}

          {/* Settings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fiscal Year Selector */}
            <FiscalYearSelector
              value={settings.fiscal_year_id}
              onChange={(id) => setSettings(prev => ({ ...prev, fiscal_year_id: id }))}
              disabled={isSaving}
            />

            {/* Model Selector */}
            <ModelSelector
              value={settings.openrouter_model}
              onChange={(model) => setSettings(prev => ({ ...prev, openrouter_model: model }))}
              disabled={isSaving}
            />
          </div>

          {/* AI Prompts Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-ink-gold/10 text-ink-gold">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold text-wood-dark">AI Prompts</h2>
                <p className="text-sm text-sepia">Customize the prompts used for AI-powered features</p>
              </div>
            </div>

            <PromptEditor
              label="CSV Categorization Prompt"
              description="Used when importing Brex CSV files to automatically suggest event/category assignments for each transaction."
              value={prompts.csv_categorization}
              defaultValue={DEFAULT_CSV_PROMPT}
              onChange={(val) => setPrompts(prev => ({ ...prev, csv_categorization: val }))}
              disabled={isSaving}
            />
            <PromptEditor
              label="PDF Extraction Prompt"
              description="Used when importing PDF invoices to extract vendor, amount, date and suggest an assignment."
              value={prompts.pdf_extraction}
              defaultValue={DEFAULT_PDF_PROMPT}
              onChange={(val) => setPrompts(prev => ({ ...prev, pdf_extraction: val }))}
              disabled={isSaving}
            />
          </div>

          {/* Budget Overview */}
          {budgetSummary && (() => {
            const setTotal = parseFloat(settings.total_budget) || 0;
            const allocated = budgetSummary.eventsBudget + budgetSummary.categoriesBudget;
            const unallocated = setTotal - allocated;

            return (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-ink-gold/10 text-ink-gold">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle>Budget Overview</CardTitle>
                      <CardDescription>
                        Set your annual budget target and track allocations across events and categories
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Editable Total Budget */}
                  <div className="p-4 rounded-lg bg-ink-gold/5 border border-ink-gold/20">
                    <label htmlFor="total_budget" className="block text-sm text-sepia mb-2">
                      Total Annual Budget
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gold font-serif text-lg">$</span>
                      <input
                        type="text"
                        id="total_budget"
                        value={settings.total_budget}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                          const parts = cleaned.split('.');
                          const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
                          setSettings(prev => ({ ...prev, total_budget: sanitized }));
                        }}
                        className="w-full pl-8 pr-4 py-2.5 rounded-md bg-parchment border border-ink-gold/40 text-2xl font-serif font-bold text-ink-gold focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold transition-colors duration-200 disabled:opacity-50"
                        placeholder="0"
                        disabled={isSaving}
                      />
                    </div>
                    {/* Allocated vs Unallocated */}
                    {setTotal > 0 && (
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-sepia">
                          Allocated: {allocated.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={unallocated >= 0 ? 'text-ink-green font-medium' : 'text-ink-red font-medium'}>
                          {unallocated >= 0 ? 'Unallocated' : 'Over-allocated'}: {Math.abs(unallocated).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Budget Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Events Budget */}
                    <div className="p-4 rounded-lg border border-wood-medium/20 bg-parchment">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-ink-gold" />
                        <span className="text-sm font-medium text-wood-dark">Events Budget</span>
                      </div>
                      <p className="text-xl font-serif font-semibold text-wood-dark">
                        {budgetSummary.eventsBudget.toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-xs text-sepia mt-1">
                        Across {budgetSummary.eventsCount} event{budgetSummary.eventsCount !== 1 ? 's' : ''}
                      </p>
                      <Link href="/events">
                        <Button variant="ghost" size="sm" className="mt-3 w-full">
                          Edit Event Budgets →
                        </Button>
                      </Link>
                    </div>

                    {/* Categories Budget */}
                    <div className="p-4 rounded-lg border border-wood-medium/20 bg-parchment">
                      <div className="flex items-center gap-2 mb-2">
                        <FolderOpen className="w-4 h-4 text-ink-green" />
                        <span className="text-sm font-medium text-wood-dark">Categories Budget</span>
                      </div>
                      <p className="text-xl font-serif font-semibold text-wood-dark">
                        {budgetSummary.categoriesBudget.toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="text-xs text-sepia mt-1">
                        Across {budgetSummary.categoriesCount} categor{budgetSummary.categoriesCount !== 1 ? 'ies' : 'y'}
                      </p>
                      <Link href="/categories">
                        <Button variant="ghost" size="sm" className="mt-3 w-full">
                          Edit Category Budgets →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Save Actions */}
          <Card>
            <CardHeader divider={false}>
              <CardTitle className="text-lg">Save Changes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-sepia mb-4">
                {hasChanges
                  ? 'You have unsaved changes. Click "Save Settings" to apply your changes.'
                  : 'No changes to save. Modify settings above to enable saving.'
                }
              </p>
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={!hasChanges || isSaving}
              >
                Discard Changes
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                isLoading={isSaving}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Settings
              </Button>
            </CardFooter>
          </Card>

          {/* Additional Info */}
          <Card className="border-dashed">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-wood-medium/10 rounded-lg">
                  <Settings className="w-6 h-6 text-wood-medium" />
                </div>
                <div>
                  <h3 className="font-serif font-medium text-wood-dark mb-1">
                    About These Settings
                  </h3>
                  <p className="text-sm text-sepia leading-relaxed">
                    The fiscal year setting determines which budget year is displayed throughout the application,
                    affecting dashboards, reports, and expense tracking. The AI model setting controls which
                    language model is used for automatic transaction categorization during imports.
                    Recommended models offer the best balance of accuracy and cost-efficiency.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 mt-8 border-t border-wood-medium/20">
        <p className="text-xs text-sepia/60 italic">
          &ldquo;A well-ordered ledger is the foundation of a prosperous enterprise.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
