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
  ListChecks,
  MessageSquare,
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Server,
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
  ConfigurableListSection,
} from "@/components/settings";
import type { ConfigItem } from "@/components/settings";
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
  checklist_phases?: ConfigItem[];
  note_types?: ConfigItem[];
}

interface BudgetSummary {
  eventsBudget: number;
  eventsCount: number;
  categoriesBudget: number;
  categoriesCount: number;
  totalBudget: number;
}

interface ApiKeyItem {
  id: string;
  agent_name: string;
  label: string | null;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard helper
// ---------------------------------------------------------------------------
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium
                 bg-spectral/10 hover:bg-spectral/20 border border-spectral/30
                 text-spectral rounded transition-all duration-200"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label || (copied ? "Copied" : "Copy")}
    </button>
  );
}

// ---------------------------------------------------------------------------
// API Keys Management Section
// ---------------------------------------------------------------------------
function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        ghostly: {
          url: typeof window !== "undefined"
            ? `${window.location.origin}/mcp`
            : "https://your-ghostly-url.com/mcp",
          authorization_token: "<your-api-key>",
        },
      },
    },
    null,
    2
  );

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      if (!res.ok) throw new Error("Failed to fetch API keys");
      const data = await res.json();
      setKeys(data.api_keys || []);
    } catch {
      setSectionError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setSectionError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: newKeyName.trim(),
          label: newKeyLabel.trim() || null,
          permissions: ["read", "write", "admin"],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create API key");
      }
      const data = await res.json();
      setRevealedKey(data.api_key.key);
      setNewKeyName("");
      setNewKeyLabel("");
      setShowForm(false);
      await fetchKeys();
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setSectionError(null);
    try {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      if (!res.ok) throw new Error("Failed to revoke key");
      await fetchKeys();
    } catch (err) {
      setSectionError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  }

  const activeKeys = keys.filter((k) => k.is_active && !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-spectral/10 text-spectral">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">API Keys</h2>
            <p className="text-sm text-muted-foreground">
              Manage keys for MCP connections and API access
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowForm(!showForm)}
        >
          New Key
        </Button>
      </div>

      {sectionError && (
        <div className="flex items-center gap-3 p-4 bg-red-400/10 border border-destructive/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-destructive text-sm">{sectionError}</p>
        </div>
      )}

      {/* Revealed key (shown once after creation) */}
      {revealedKey && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-md text-sm">
              <span className="font-semibold">Save this key now.</span> It will
              not be shown again.
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="flex-1 px-3 py-2 bg-card border border-border rounded text-sm font-mono break-all select-all">
                {revealedKey}
              </code>
              <CopyButton text={revealedKey} label="Copy" />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRevealedKey(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generate New API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. claude, my-agent"
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg
                           text-foreground placeholder:text-mist/60
                           focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                           transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="e.g. Production key"
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg
                           text-foreground placeholder:text-mist/60
                           focus:ring-2 focus:ring-spectral/20 focus:border-spectral
                           transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                isLoading={creating}
                disabled={!newKeyName.trim()}
              >
                Generate Key
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active keys list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Active Keys ({activeKeys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-4">
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : activeKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No active API keys. Create one to connect via MCP.
            </p>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-background"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {k.agent_name}
                      </span>
                      {k.label && (
                        <span className="text-xs text-muted-foreground">
                          ({k.label})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        Created{" "}
                        {new Date(k.created_at).toLocaleDateString()}
                      </span>
                      {k.last_used_at && (
                        <span>
                          Last used{" "}
                          {new Date(k.last_used_at).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-spectral/70">
                        {k.permissions.join(", ")}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(k.id)}
                    className="text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            {revokedKeys.length} revoked key{revokedKeys.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2">
            {revokedKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center gap-3 p-2 rounded border border-border/50 opacity-50"
              >
                <span className="text-sm text-foreground line-through">
                  {k.agent_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  Revoked{" "}
                  {k.revoked_at
                    ? new Date(k.revoked_at).toLocaleDateString()
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* MCP Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-spectral/10 text-spectral">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>MCP Configuration</CardTitle>
              <CardDescription>
                Add this to your Claude Desktop or MCP client config
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-end">
            <CopyButton text={mcpConfig} label="Copy Config" />
          </div>
          <pre className="px-4 py-3 bg-card border border-border rounded-lg text-foreground font-mono text-xs overflow-x-auto whitespace-pre">
            {mcpConfig}
          </pre>
          <p className="text-xs text-muted-foreground">
            Replace <code className="text-spectral">&lt;your-api-key&gt;</code>{" "}
            with an active API key from above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
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

  // Configurable phases and note types
  const [checklistPhases, setChecklistPhases] = useState<ConfigItem[]>([]);
  const [originalChecklistPhases, setOriginalChecklistPhases] = useState<ConfigItem[]>([]);
  const [noteTypes, setNoteTypes] = useState<ConfigItem[]>([]);
  const [originalNoteTypes, setOriginalNoteTypes] = useState<ConfigItem[]>([]);

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
      prompts.pdf_extraction !== originalPrompts?.pdf_extraction ||
      JSON.stringify(checklistPhases) !== JSON.stringify(originalChecklistPhases) ||
      JSON.stringify(noteTypes) !== JSON.stringify(originalNoteTypes));

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

      // Load configurable phases and note types
      const phases = (data.checklist_phases || []) as ConfigItem[];
      setChecklistPhases(phases);
      setOriginalChecklistPhases(phases);

      const types = (data.note_types || []) as ConfigItem[];
      setNoteTypes(types);
      setOriginalNoteTypes(types);

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
          checklist_phases: checklistPhases,
          note_types: noteTypes,
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

      const updatedPhases = (data.checklist_phases || []) as ConfigItem[];
      setChecklistPhases(updatedPhases);
      setOriginalChecklistPhases(updatedPhases);

      const updatedNoteTypes = (data.note_types || []) as ConfigItem[];
      setNoteTypes(updatedNoteTypes);
      setOriginalNoteTypes(updatedNoteTypes);

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
      setChecklistPhases(originalChecklistPhases);
      setNoteTypes(originalNoteTypes);
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

          {/* Configurable Phases & Types */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfigurableListSection
              title="Checklist Phases"
              description="Phases used to organize checklist items for events"
              icon={<ListChecks className="w-5 h-5" />}
              items={checklistPhases}
              onChange={setChecklistPhases}
              disabled={isSaving}
            />

            <ConfigurableListSection
              title="Note Types"
              description="Categories used to classify event notes"
              icon={<MessageSquare className="w-5 h-5" />}
              items={noteTypes}
              onChange={setNoteTypes}
              disabled={isSaving}
            />
          </div>

          {/* API Keys Management */}
          <ApiKeysSection />

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
