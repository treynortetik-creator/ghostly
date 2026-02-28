"use client";

/**
 * Ghostly Agent Settings Page
 *
 * Configure the AI agent: name, focus, heartbeat, notifications.
 * Part of the Settings section in the AppShell sidebar.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Bot,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Bell,
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

interface AgentSettingsData {
  agent_name: string;
  agent_focus: string;
  heartbeat_enabled: boolean;
  heartbeat_time: string;
  notification_channel: string;
}

const defaultSettings: AgentSettingsData = {
  agent_name: "Ghostly",
  agent_focus: "",
  heartbeat_enabled: false,
  heartbeat_time: "07:00",
  notification_channel: "in_app",
};

export default function AgentSettingsPage() {
  const [settings, setSettings] = useState<AgentSettingsData>(defaultSettings);
  const [originalSettings, setOriginalSettings] =
    useState<AgentSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasChanges =
    originalSettings &&
    (settings.agent_name !== originalSettings.agent_name ||
      settings.agent_focus !== originalSettings.agent_focus ||
      settings.heartbeat_enabled !== originalSettings.heartbeat_enabled ||
      settings.heartbeat_time !== originalSettings.heartbeat_time ||
      settings.notification_channel !== originalSettings.notification_channel);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/settings");
      if (!res.ok) throw new Error("Failed to fetch agent settings");
      const data = await res.json();
      const s: AgentSettingsData = {
        agent_name: data.settings.agent_name || "Ghostly",
        agent_focus: data.settings.agent_focus || "",
        heartbeat_enabled: data.settings.heartbeat_enabled || false,
        heartbeat_time: data.settings.heartbeat_time || "07:00",
        notification_channel: data.settings.notification_channel || "in_app",
      };
      setSettings(s);
      setOriginalSettings(s);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load agent settings"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/agent/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      const data = await res.json();
      const updated: AgentSettingsData = {
        agent_name: data.settings.agent_name || "Ghostly",
        agent_focus: data.settings.agent_focus || "",
        heartbeat_enabled: data.settings.heartbeat_enabled || false,
        heartbeat_time: data.settings.heartbeat_time || "07:00",
        notification_channel: data.settings.notification_channel || "in_app",
      };
      setSettings(updated);
      setOriginalSettings(updated);
      setSuccessMessage("Agent settings saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save agent settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Bot className="w-8 h-8 text-spectral" />
            AI Agent Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Configure your AI assistant &middot; As of {formattedDate}
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
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-spectral animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Loading agent settings...</p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-400/10 border border-destructive/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-3 p-4 bg-emerald-400/10 border border-emerald-400/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-emerald-400">{successMessage}</p>
            </div>
          )}

          {/* Agent Identity */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-spectral/10 text-spectral">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Agent Identity</CardTitle>
                  <CardDescription>
                    Customize how the AI agent presents itself
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Agent Name */}
              <div>
                <label
                  htmlFor="agent_name"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Agent Name
                </label>
                <input
                  type="text"
                  id="agent_name"
                  value={settings.agent_name}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      agent_name: e.target.value,
                    }))
                  }
                  maxLength={50}
                  placeholder="Ghostly"
                  className="w-full max-w-sm px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The name shown in the chat panel header and messages.
                </p>
              </div>

              {/* Agent Focus */}
              <div>
                <label
                  htmlFor="agent_focus"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Agent Focus / Custom Instructions
                </label>
                <textarea
                  id="agent_focus"
                  value={settings.agent_focus}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      agent_focus: e.target.value,
                    }))
                  }
                  maxLength={2000}
                  rows={4}
                  placeholder="e.g., Focus on Q2 events and flag any expenses over $5,000. Always suggest budget reallocation when events are over budget."
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors resize-y min-h-[100px] disabled:opacity-50"
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Custom instructions that shape how the agent responds. These
                  are added to the system prompt for every conversation.
                  {settings.agent_focus.length > 0 && (
                    <span className="ml-2 text-spectral">
                      {settings.agent_focus.length}/2000
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Heartbeat Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-spectral/10 text-spectral">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Daily Heartbeat</CardTitle>
                  <CardDescription>
                    Get a daily summary of events, overdue tasks, and budget
                    alerts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Heartbeat Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Enable Daily Heartbeat
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Receive an automated daily briefing from your agent
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      heartbeat_enabled: !prev.heartbeat_enabled,
                    }))
                  }
                  disabled={isSaving}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                    border-2 border-transparent transition-colors duration-200 ease-in-out
                    focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:ring-offset-2 focus:ring-offset-background
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${settings.heartbeat_enabled ? "bg-spectral" : "bg-border"}
                  `}
                  role="switch"
                  aria-checked={settings.heartbeat_enabled}
                  aria-label="Toggle daily heartbeat"
                >
                  <span
                    className={`
                      pointer-events-none inline-block h-5 w-5 transform rounded-full
                      bg-white shadow ring-0 transition duration-200 ease-in-out
                      ${settings.heartbeat_enabled ? "translate-x-5" : "translate-x-0"}
                    `}
                  />
                </button>
              </div>

              {/* Heartbeat Time */}
              {settings.heartbeat_enabled && (
                <div>
                  <label
                    htmlFor="heartbeat_time"
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    Delivery Time
                  </label>
                  <input
                    type="time"
                    id="heartbeat_time"
                    value={settings.heartbeat_time}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        heartbeat_time: e.target.value,
                      }))
                    }
                    className="w-40 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Time in your local timezone when the daily briefing is sent.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-spectral/10 text-spectral">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Where the agent sends alerts and heartbeat summaries
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <label
                  htmlFor="notification_channel"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Notification Channel
                </label>
                <select
                  id="notification_channel"
                  value={settings.notification_channel}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      notification_channel: e.target.value,
                    }))
                  }
                  className="w-full max-w-sm px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                  disabled={isSaving}
                >
                  <option value="in_app">In-App (Chat Panel)</option>
                  <option value="slack">Slack (coming soon)</option>
                  <option value="email">Email (coming soon)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Slack and email integrations require additional configuration.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Actions */}
          <Card>
            <CardHeader divider={false}>
              <CardTitle className="text-lg">Save Changes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                {hasChanges
                  ? 'You have unsaved changes. Click "Save Settings" to apply.'
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

          {/* Info Card */}
          <Card className="border-dashed">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-spectral/10 rounded-lg">
                  <Bot className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">
                    About the AI Agent
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The Ghostly AI agent can query your events, track budgets,
                    find overdue tasks, create expenses, and help manage your
                    event portfolio. Use the floating chat button on any page to
                    start a conversation. Custom instructions help the agent
                    focus on what matters most to your team.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
