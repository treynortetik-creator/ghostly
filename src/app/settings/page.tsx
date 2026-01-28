'use client';

import { useEffect, useState, useCallback } from 'react';
import { Settings, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { FiscalYearSelector, ModelSelector } from '@/components/settings';
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
}

interface SettingsApiResponse {
  settings: SettingsData;
  fiscal_year: FiscalYear | null;
}

export default function SettingsPage() {
  // Settings state
  const [settings, setSettings] = useState<SettingsData>({
    fiscal_year_id: '',
    openrouter_model: 'anthropic/claude-3-haiku',
  });
  const [originalSettings, setOriginalSettings] = useState<SettingsData | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if settings have changed
  const hasChanges = originalSettings && (
    settings.fiscal_year_id !== originalSettings.fiscal_year_id ||
    settings.openrouter_model !== originalSettings.openrouter_model
  );

  // Fetch current settings
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');

      const data: SettingsApiResponse = await response.json();
      const fetchedSettings = {
        fiscal_year_id: data.settings.fiscal_year_id,
        openrouter_model: data.settings.openrouter_model,
      };
      setSettings(fetchedSettings);
      setOriginalSettings(fetchedSettings);
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
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      const data = await response.json();
      const updatedSettings = {
        fiscal_year_id: data.settings.fiscal_year_id,
        openrouter_model: data.settings.openrouter_model,
      };
      setSettings(updatedSettings);
      setOriginalSettings(updatedSettings);
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
