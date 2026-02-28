"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Settings,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Calendar,
  FolderOpen,
  Bot,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/Card";
import {
  FiscalYearSelector,
  ModelSelector,
  PromptEditor,
  EventTypesSection,
} from "@/components/settings";
import { DEFAULT_CSV_PROMPT, DEFAULT_PDF_PROMPT } from "@/lib/openrouter";
import type { FiscalYear } from "@/types/database";
import { formatCurrency } from "@/lib/format";

/* ============================================
   SETTINGS PAGE
   ============================================
   Application configuration page for managing
   fiscal years and AI model selection.
   Ghostly theme: "The Configuration Chambers"
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
  prompts?: {
    csv_categorization: string | null;
    pdf_extraction: string | null;
  };
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
    fiscal_year_id: "",
    openrouter_model: "anthropic/claude-3-haiku",
    total_budget: "0",
  });
  const [originalSettings, setOriginalSettings] = useState<SettingsData | null>(
    null,
  );
  const [prompts, setPrompts] = useState<{
    csv_categorization: string | null;
    pdf_extraction: string | null;
  }>({
    csv_categorization: null,
    pdf_extraction: null,
  });
  const [originalPrompts, setOriginalPrompts] = useState<typeof prompts | null>(
    null,
  );
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(
    null,
  );

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if settings have changed
  const hasChanges =
    originalSettings &&
    (settings.fiscal_year_id !== originalSettings.fiscal_year_id ||
      settings.openrouter_model !== originalSettings.openrouter_model ||
      settings.total_budget !== originalSettings.total_budget ||
      prompts.csv_categorization !== originalPrompts?.csv_categorization ||
      prompts.pdf_extraction !== originalPrompts?.pdf_extraction);

  // Fetch current settings and budget summary
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Fetch settings, events, and categories in parallel
      const [settingsRes, eventsRes, categoriesRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/events"),
        fetch("/api/categories"),
      ]);

      if (!settingsRes.ok) throw new Error("Failed to fetch settings");

      const data: SettingsApiResponse = await settingsRes.json();
      const fetchedSettings: SettingsData = {
        fiscal_year_id: data.settings.fiscal_year_id,
        openrouter_model: data.settings.openrouter_model,
        total_budget: (data.settings.total_budget ?? 0).toString(),
      };
      setSettings(fetchedSettings);
      setOriginalSettings(fetchedSettings);

      const fetchedPrompts = data.prompts || {
        csv_categorization: null,
        pdf_extraction: null,
      };
      setPrompts(fetchedPrompts);
      setOriginalPrompts(fetchedPrompts);

      // Calculate budget summary
      if (eventsRes.ok && categoriesRes.ok) {
        const eventsData = await eventsRes.json();
        const categoriesData = await categoriesRes.json();

        const eventsBudget =
          eventsData.events?.reduce(
            (sum: number, e: { budget_amount: number }) =>
              sum + (e.budget_amount || 0),
            0,
          ) || 0;
        const categoriesBudget =
          categoriesData.categories?.reduce(
            (sum: number, c: { budget_amount: number }) =>
              sum + (c.budget_amount || 0),
            0,
          ) || 0;

        setBudgetSummary({
          eventsBudget,
          eventsCount: eventsData.events?.length || 0,
          categoriesBudget,
          categoriesCount: categoriesData.categories?.length || 0,
          totalBudget: eventsBudget + categoriesBudget,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
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
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscal_year_id: settings.fiscal_year_id,
          openrouter_model: settings.openrouter_model,
          total_budget: parseFloat(settings.total_budget) || 0,
          prompts,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }

      const data = await response.json();
      const updatedSettings: SettingsData = {
        fiscal_year_id: data.settings.fiscal_year_id,
        openrouter_model: data.settings.openrouter_model,
        total_budget: (data.settings.total_budget ?? 0).toString(),
      };
      setSettings(updatedSettings);
      setOriginalSettings(updatedSettings);

      const updatedPrompts = data.prompts || {
        csv_categorization: null,
        pdf_extraction: null,
      };
      setPrompts(updatedPrompts);
      setOriginalPrompts(updatedPrompts);

      setSuccessMessage("Settings saved successfully");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
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
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell>
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
       
      >
        <div>
          <h1
            className="text-3xl font-bold text-foreground flex items-center gap-3"
           
          >
            <Settings className="w-8 h-8 text-spectral" />
            The Configuration Chambers
          </h1>
          <p className="mt-1 text-muted-foreground">
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
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
             
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          className="flex items-center justify-center py-16"
         
        >
          <div className="text-center">
            <RefreshCw
              className="w-8 h-8 text-spectral animate-spin mx-auto mb-3"
             
            />
            <p className="text-muted-foreground">
              Loading settings...
            </p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div
              className="flex items-center gap-3 p-4 bg-red-400/10 border border-destructive/30 rounded-lg"
             
            >
              <AlertCircle
                className="w-5 h-5 text-destructive flex-shrink-0"
               
              />
              <p className="text-destructive">
                {error}
              </p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div
              className="flex items-center gap-3 p-4 bg-emerald-400/10 border border-emerald-400/30 rounded-lg"
             
            >
              <CheckCircle
                className="w-5 h-5 text-emerald-400 flex-shrink-0"
               
              />
              <p className="text-emerald-400">
                {successMessage}
              </p>
            </div>
          )}

          {/* Settings Grid */}
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
           
          >
            {/* Fiscal Year Selector */}
            <FiscalYearSelector
              value={settings.fiscal_year_id}
              onChange={(id) =>
                setSettings((prev) => ({ ...prev, fiscal_year_id: id }))
              }
              disabled={isSaving}
             
            />

            {/* Model Selector */}
            <ModelSelector
              value={settings.openrouter_model}
              onChange={(model) =>
                setSettings((prev) => ({ ...prev, openrouter_model: model }))
              }
              disabled={isSaving}
             
            />
          </div>

          {/* AI Prompts Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-md bg-spectral/10 text-spectral"
               
              >
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2
                  className="text-xl font-bold text-foreground"
                 
                >
                  AI Prompts
                </h2>
                <p className="text-sm text-muted-foreground">
                  Customize the prompts used for AI-powered features
                </p>
              </div>
            </div>

            <PromptEditor
              label="CSV Categorization Prompt"
              description="Used when importing Brex CSV files to automatically suggest event/category assignments for each transaction."
              value={prompts.csv_categorization}
              defaultValue={DEFAULT_CSV_PROMPT}
              onChange={(val) =>
                setPrompts((prev) => ({ ...prev, csv_categorization: val }))
              }
              disabled={isSaving}
             
            />

            <PromptEditor
              label="PDF Extraction Prompt"
              description="Used when importing PDF invoices to extract vendor, amount, date and suggest an assignment."
              value={prompts.pdf_extraction}
              defaultValue={DEFAULT_PDF_PROMPT}
              onChange={(val) =>
                setPrompts((prev) => ({ ...prev, pdf_extraction: val }))
              }
              disabled={isSaving}
             
            />
          </div>

          {/* Event Type Budgets */}
          {settings.fiscal_year_id && (
            <EventTypesSection
              fiscalYearId={settings.fiscal_year_id}
              disabled={isSaving}
             
            />
          )}

          {/* Budget Overview */}
          {budgetSummary &&
            (() => {
              const setTotal = parseFloat(settings.total_budget) || 0;
              const allocated =
                budgetSummary.eventsBudget + budgetSummary.categoriesBudget;
              const unallocated = setTotal - allocated;

              return (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-md bg-spectral/10 text-spectral"
                       
                      >
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle>
                          Budget Overview
                        </CardTitle>
                        <CardDescription>
                          Set your annual budget target and track allocations
                          across events and categories
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Editable Total Budget */}
                    <div
                      className="p-4 rounded-lg bg-spectral/10 border border-spectral"
                     
                    >
                      <label
                        htmlFor="total_budget"
                        className="block text-sm text-muted-foreground mb-2"
                       
                      >
                        Total Annual Budget
                      </label>
                      <div className="relative">
                        <span
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-spectral text-lg"
                         
                        >
                          $
                        </span>
                        <input
                          type="text"
                          id="total_budget"
                          value={settings.total_budget}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(
                              /[^0-9.]/g,
                              "",
                            );
                            const parts = cleaned.split(".");
                            const sanitized =
                              parts.length > 2
                                ? parts[0] + "." + parts.slice(1).join("")
                                : cleaned;
                            setSettings((prev) => ({
                              ...prev,
                              total_budget: sanitized,
                            }));
                          }}
                          className="w-full pl-8 pr-4 py-2.5 rounded-md bg-background border border-spectral text-2xl font-bold text-spectral focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors duration-200 disabled:opacity-50"
                          placeholder="0"
                          disabled={isSaving}
                         
                        />
                      </div>
                      {/* Allocated vs Unallocated */}
                      {setTotal > 0 && (
                        <div
                          className="mt-3 flex items-center justify-between text-sm"
                         
                        >
                          <span className="text-muted-foreground">
                            Allocated:{" "}
                            {formatCurrency(allocated)}
                          </span>
                          <span
                            className={
                              unallocated >= 0
                                ? "text-emerald-400 font-medium"
                                : "text-destructive font-medium"
                            }
                           
                          >
                            {unallocated >= 0
                              ? "Unallocated"
                              : "Over-allocated"}
                            :{" "}
                            {formatCurrency(Math.abs(unallocated))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Budget Breakdown */}
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                     
                    >
                      {/* Events Budget */}
                      <div
                        className="p-4 rounded-lg border border-border bg-background"
                       
                      >
                        <div
                          className="flex items-center gap-2 mb-2"
                         
                        >
                          <Calendar
                            className="w-4 h-4 text-spectral"
                           
                          />
                          <span
                            className="text-sm font-medium text-foreground"
                           
                          >
                            Events Budget
                          </span>
                        </div>
                        <p
                          className="text-xl font-semibold text-foreground"
                         
                        >
                          {formatCurrency(budgetSummary.eventsBudget)}
                        </p>
                        <p
                          className="text-xs text-muted-foreground mt-1"
                         
                        >
                          Across {budgetSummary.eventsCount} event
                          {budgetSummary.eventsCount !== 1 ? "s" : ""}
                        </p>
                        <Link href="/events">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 w-full"
                           
                          >
                            Edit Event Budgets →
                          </Button>
                        </Link>
                      </div>

                      {/* Categories Budget */}
                      <div
                        className="p-4 rounded-lg border border-border bg-background"
                       
                      >
                        <div
                          className="flex items-center gap-2 mb-2"
                         
                        >
                          <FolderOpen
                            className="w-4 h-4 text-emerald-400"
                           
                          />
                          <span
                            className="text-sm font-medium text-foreground"
                           
                          >
                            Categories Budget
                          </span>
                        </div>
                        <p
                          className="text-xl font-semibold text-foreground"
                         
                        >
                          {formatCurrency(budgetSummary.categoriesBudget)}
                        </p>
                        <p
                          className="text-xs text-muted-foreground mt-1"
                         
                        >
                          Across {budgetSummary.categoriesCount} categor
                          {budgetSummary.categoriesCount !== 1 ? "ies" : "y"}
                        </p>
                        <Link href="/categories">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 w-full"
                           
                          >
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
              <CardTitle className="text-lg">
                Save Changes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                {hasChanges
                  ? 'You have unsaved changes. Click "Save Settings" to apply your changes.'
                  : "No changes to save. Modify settings above to enable saving."}
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
                <div
                  className="p-2 bg-spectral/10 rounded-lg"
                 
                >
                  <Settings
                    className="w-6 h-6 text-muted-foreground"
                   
                  />
                </div>
                <div>
                  <h3
                    className="font-medium text-foreground mb-1"
                   
                  >
                    About These Settings
                  </h3>
                  <p
                    className="text-sm text-muted-foreground leading-relaxed"
                   
                  >
                    The fiscal year setting determines which budget year is
                    displayed throughout the application, affecting dashboards,
                    reports, and expense tracking. The AI model setting controls
                    which language model is used for automatic transaction
                    categorization during imports. Recommended models offer the
                    best balance of accuracy and cost-efficiency.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div
        className="text-center py-6 mt-8 border-t border-border"
       
      >
        <p className="text-xs text-muted-foreground/60 italic">
          &ldquo;A well-ordered ledger is the foundation of a prosperous
          enterprise.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
