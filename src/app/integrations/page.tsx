"use client";

/**
 * Ghostly Integrations Page
 *
 * Manage Slack connection, notification routing, and digest settings.
 */

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Bot,
  DollarSign,
  Bell,
  Clock,
  Link2,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";

/* ============================================
   Types
   ============================================ */

interface Integration {
  id: string;
  provider: string;
  status: string;
  credentials: {
    team_name?: string;
    team_id?: string;
    channel?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

interface NotificationRoute {
  notification_type: string;
  enabled: boolean;
  destination: string;
}

interface DigestConfig {
  digest_type: string;
  enabled: boolean;
  hour: number;
  day_of_week?: number;
}

type SectionKey = "slack" | "routing" | "digest";

const NOTIFICATION_TYPES = [
  {
    type: "agent_message",
    label: "Agent Messages",
    icon: Bot,
    color: "text-spectral",
  },
  {
    type: "budget_alert",
    label: "Budget Alerts",
    icon: DollarSign,
    color: "text-amber-400",
  },
  {
    type: "task_reminder",
    label: "Task Reminders",
    icon: Bell,
    color: "text-blue-400",
  },
  {
    type: "custom_reminder",
    label: "Custom Reminders",
    icon: Clock,
    color: "text-emerald-400",
  },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}`,
}));

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

/* ============================================
   Collapsible Section Header
   ============================================ */

function SectionHeader({
  icon,
  title,
  description,
  collapsed,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <CardHeader>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-spectral/10 text-spectral">
            {icon}
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>
    </CardHeader>
  );
}

/* ============================================
   Main Page Component
   ============================================ */

function IntegrationsPageContent() {
  const searchParams = useSearchParams();

  // --- Integration state ---
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [routes, setRoutes] = useState<NotificationRoute[]>([]);
  const [digests, setDigests] = useState<DigestConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Saving states ---
  const [isSavingRoutes, setIsSavingRoutes] = useState(false);
  const [isSavingDigest, setIsSavingDigest] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // --- Collapsible sections ---
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    slack: false,
    routing: false,
    digest: false,
  });

  const toggleSection = (key: SectionKey) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // --- Derived state ---
  const slackIntegration = integrations.find(
    (i) => i.provider === "slack" && i.status === "active"
  );
  const isSlackConnected = !!slackIntegration;

  // --- Check URL params for OAuth callback ---
  useEffect(() => {
    const success = searchParams.get("success");
    const errorParam = searchParams.get("error");

    if (success === "slack_connected") {
      setSuccessMessage("Slack workspace connected successfully!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  /* ---------- Fetch integrations ---------- */
  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (!res.ok) throw new Error("Failed to fetch integrations");
      const data = await res.json();
      setIntegrations(data.integrations || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load integrations"
      );
    }
  }, []);

  /* ---------- Fetch notification routes ---------- */
  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/notification-routes");
      if (!res.ok) throw new Error("Failed to fetch notification routes");
      const data = await res.json();
      setRoutes(data.routes || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load notification routes"
      );
    }
  }, []);

  /* ---------- Fetch digest config ---------- */
  const fetchDigestConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/digest-config");
      if (!res.ok) throw new Error("Failed to fetch digest config");
      const data = await res.json();
      setDigests(data.configs || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load digest config"
      );
    }
  }, []);

  /* ---------- Initial load ---------- */
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      setError(null);
      await Promise.all([
        fetchIntegrations(),
        fetchRoutes(),
        fetchDigestConfig(),
      ]);
      setIsLoading(false);
    };
    loadAll();
  }, [fetchIntegrations, fetchRoutes, fetchDigestConfig]);

  /* ---------- Disconnect Slack ---------- */
  const handleDisconnect = async () => {
    if (!slackIntegration) return;
    setIsDisconnecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${slackIntegration.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to disconnect Slack");
      setSuccessMessage("Slack disconnected successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchIntegrations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to disconnect Slack"
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  /* ---------- Save notification routes ---------- */
  const handleSaveRoutes = async () => {
    setIsSavingRoutes(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/integrations/notification-routes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save notification routes");
      }
      setSuccessMessage("Notification routes saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save notification routes"
      );
    } finally {
      setIsSavingRoutes(false);
    }
  };

  /* ---------- Save digest config ---------- */
  const handleSaveDigest = async () => {
    setIsSavingDigest(true);
    setError(null);
    setSuccessMessage(null);
    try {
      for (const config of digests) {
        const res = await fetch("/api/integrations/digest-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save digest config");
        }
      }
      setSuccessMessage("Digest settings saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save digest settings"
      );
    } finally {
      setIsSavingDigest(false);
    }
  };

  /* ---------- Route helpers ---------- */
  const getRoute = (type: string): NotificationRoute => {
    const existing = routes.find((r) => r.notification_type === type);
    return existing || { notification_type: type, enabled: false, destination: "dm" };
  };

  const updateRoute = (type: string, updates: Partial<NotificationRoute>) => {
    setRoutes((prev) => {
      const idx = prev.findIndex((r) => r.notification_type === type);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...updates };
        return updated;
      }
      return [
        ...prev,
        {
          notification_type: type,
          enabled: false,
          destination: "dm",
          ...updates,
        },
      ];
    });
  };

  /* ---------- Digest helpers ---------- */
  const getDigest = (type: string): DigestConfig => {
    const existing = digests.find((d) => d.digest_type === type);
    return (
      existing || {
        digest_type: type,
        enabled: false,
        hour: 9,
        ...(type === "weekly" ? { day_of_week: 1 } : {}),
      }
    );
  };

  const updateDigest = (type: string, updates: Partial<DigestConfig>) => {
    setDigests((prev) => {
      const idx = prev.findIndex((d) => d.digest_type === type);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...updates };
        return updated;
      }
      return [
        ...prev,
        {
          digest_type: type,
          enabled: false,
          hour: 9,
          ...(type === "weekly" ? { day_of_week: 1 } : {}),
          ...updates,
        },
      ];
    });
  };

  /* ---------- Render ---------- */
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
            <MessageSquare className="w-8 h-8 text-spectral" />
            Integrations
          </h1>
          <p className="mt-1 text-muted-foreground">
            Connect external services &amp; configure notifications &middot; As
            of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchIntegrations();
              fetchRoutes();
              fetchDigestConfig();
            }}
            disabled={isLoading}
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
            <p className="text-muted-foreground">Loading integrations...</p>
          </div>
        </div>
      )}

      {/* Content */}
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

          {/* ========== Slack Connection ========== */}
          <Card>
            <SectionHeader
              icon={<MessageSquare className="w-5 h-5" />}
              title="Slack Connection"
              description="Connect your Slack workspace to receive notifications"
              collapsed={collapsed.slack}
              onToggle={() => toggleSection("slack")}
            />
            {!collapsed.slack && (
              <CardContent className="space-y-4">
                {isSlackConnected ? (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/50">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-md bg-emerald-400/10">
                        <Link2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {slackIntegration.credentials.team_name ||
                            "Slack Workspace"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Connected
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      isLoading={isDisconnecting}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">
                      No Slack workspace connected
                    </p>
                    <p className="text-xs text-muted-foreground/70 mb-4">
                      Connect Slack to receive notifications, digests, and agent
                      messages directly in your workspace.
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => {
                        window.location.href =
                          "/api/integrations/slack/oauth/authorize";
                      }}
                      leftIcon={<MessageSquare className="w-4 h-4" />}
                    >
                      Connect Slack
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* ========== Notification Routing ========== */}
          {isSlackConnected && (
            <Card>
              <SectionHeader
                icon={<Bell className="w-5 h-5" />}
                title="Notification Routing"
                description="Choose which notifications get sent to Slack"
                collapsed={collapsed.routing}
                onToggle={() => toggleSection("routing")}
              />
              {!collapsed.routing && (
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {NOTIFICATION_TYPES.map((nt) => {
                      const route = getRoute(nt.type);
                      const Icon = nt.icon;

                      return (
                        <div
                          key={nt.type}
                          className="flex items-center justify-between p-4 rounded-lg border border-border bg-background/50"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-5 h-5 ${nt.color}`} />
                            <span className="text-sm font-medium text-foreground">
                              {nt.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Destination selector */}
                            <select
                              value={route.destination}
                              onChange={(e) =>
                                updateRoute(nt.type, {
                                  destination: e.target.value,
                                })
                              }
                              className="px-3 py-1.5 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                              disabled={!route.enabled}
                            >
                              <option value="dm">DM</option>
                              <option value="channel">Channel</option>
                            </select>

                            {/* Toggle */}
                            <button
                              onClick={() =>
                                updateRoute(nt.type, {
                                  enabled: !route.enabled,
                                })
                              }
                              className={`
                                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                                border-2 border-transparent transition-colors duration-200 ease-in-out
                                focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:ring-offset-2 focus:ring-offset-background
                                ${route.enabled ? "bg-spectral" : "bg-border"}
                              `}
                              role="switch"
                              aria-checked={route.enabled}
                              aria-label={`Toggle ${nt.label}`}
                            >
                              <span
                                className={`
                                  pointer-events-none inline-block h-5 w-5 transform rounded-full
                                  bg-white shadow ring-0 transition duration-200 ease-in-out
                                  ${route.enabled ? "translate-x-5" : "translate-x-0"}
                                `}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveRoutes}
                      disabled={isSavingRoutes}
                      isLoading={isSavingRoutes}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Save Routes
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ========== Digest Settings ========== */}
          {isSlackConnected && (
            <Card>
              <SectionHeader
                icon={<Clock className="w-5 h-5" />}
                title="Digest Settings"
                description="Configure daily and weekly digest summaries sent to Slack"
                collapsed={collapsed.digest}
                onToggle={() => toggleSection("digest")}
              />
              {!collapsed.digest && (
                <CardContent className="space-y-6">
                  {/* Daily Digest */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Daily Digest
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Receive a daily summary of events, tasks, and budget
                          status
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          updateDigest("daily", {
                            enabled: !getDigest("daily").enabled,
                          })
                        }
                        className={`
                          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                          border-2 border-transparent transition-colors duration-200 ease-in-out
                          focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:ring-offset-2 focus:ring-offset-background
                          ${getDigest("daily").enabled ? "bg-spectral" : "bg-border"}
                        `}
                        role="switch"
                        aria-checked={getDigest("daily").enabled}
                        aria-label="Toggle daily digest"
                      >
                        <span
                          className={`
                            pointer-events-none inline-block h-5 w-5 transform rounded-full
                            bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${getDigest("daily").enabled ? "translate-x-5" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>
                    {getDigest("daily").enabled && (
                      <div>
                        <label
                          htmlFor="daily_hour"
                          className="block text-sm font-medium text-foreground mb-1.5"
                        >
                          Send at
                        </label>
                        <select
                          id="daily_hour"
                          value={getDigest("daily").hour}
                          onChange={(e) =>
                            updateDigest("daily", {
                              hour: Number(e.target.value),
                            })
                          }
                          className="w-full max-w-sm px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                        >
                          {HOURS.map((h) => (
                            <option key={h.value} value={h.value}>
                              {h.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                  {/* Weekly Digest */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Weekly Digest
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Receive a weekly rollup of key metrics and upcoming
                          events
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          updateDigest("weekly", {
                            enabled: !getDigest("weekly").enabled,
                          })
                        }
                        className={`
                          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                          border-2 border-transparent transition-colors duration-200 ease-in-out
                          focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:ring-offset-2 focus:ring-offset-background
                          ${getDigest("weekly").enabled ? "bg-spectral" : "bg-border"}
                        `}
                        role="switch"
                        aria-checked={getDigest("weekly").enabled}
                        aria-label="Toggle weekly digest"
                      >
                        <span
                          className={`
                            pointer-events-none inline-block h-5 w-5 transform rounded-full
                            bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${getDigest("weekly").enabled ? "translate-x-5" : "translate-x-0"}
                          `}
                        />
                      </button>
                    </div>
                    {getDigest("weekly").enabled && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label
                            htmlFor="weekly_day"
                            className="block text-sm font-medium text-foreground mb-1.5"
                          >
                            Day
                          </label>
                          <select
                            id="weekly_day"
                            value={getDigest("weekly").day_of_week ?? 1}
                            onChange={(e) =>
                              updateDigest("weekly", {
                                day_of_week: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                          >
                            {DAYS_OF_WEEK.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label
                            htmlFor="weekly_hour"
                            className="block text-sm font-medium text-foreground mb-1.5"
                          >
                            Time
                          </label>
                          <select
                            id="weekly_hour"
                            value={getDigest("weekly").hour}
                            onChange={(e) =>
                              updateDigest("weekly", {
                                hour: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                          >
                            {HOURS.map((h) => (
                              <option key={h.value} value={h.value}>
                                {h.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveDigest}
                      disabled={isSavingDigest}
                      isLoading={isSavingDigest}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Save Digest Settings
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* ========== Info Card ========== */}
          <Card className="border-dashed">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-spectral/10 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">
                    About Integrations
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Connect Slack to receive real-time notifications for agent
                    messages, budget alerts, task reminders, and more. Configure
                    daily and weekly digests to stay on top of your event
                    portfolio without checking the app.
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

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsPageContent />
    </Suspense>
  );
}
