"use client";

/**
 * Ghostly Agent Settings Page
 *
 * Configure the AI agent: name, focus, heartbeat, notifications, scheduled tasks.
 * All setting cards are collapsible. Scheduled tasks have full CRUD.
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
  ChevronDown,
  ChevronRight,
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  X,
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

/* ============================================
   Types
   ============================================ */

interface AgentSettingsData {
  agent_name: string;
  agent_focus: string;
  heartbeat_enabled: boolean;
  heartbeat_time: string;
  notification_channel: string;
}

interface ScheduledTask {
  id: string;
  name: string;
  schedule_preset: string;
  cron_expression: string;
  agent_prompt: string;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
}

type SectionKey = "identity" | "heartbeat" | "notifications" | "scheduled";

const defaultSettings: AgentSettingsData = {
  agent_name: "Ghostly",
  agent_focus: "",
  heartbeat_enabled: false,
  heartbeat_time: "07:00",
  notification_channel: "in_app",
};

/* ============================================
   Schedule Presets
   ============================================ */

const SCHEDULE_PRESETS: { value: string; label: string; cron: string }[] = [
  { value: "every_hour", label: "Every hour", cron: "0 * * * *" },
  { value: "every_day_9am", label: "Every day at 9:00 AM", cron: "0 9 * * *" },
  { value: "every_monday_9am", label: "Every Monday at 9:00 AM", cron: "0 9 * * 1" },
  { value: "every_weekday_9am", label: "Every weekday at 9:00 AM", cron: "0 9 * * 1-5" },
  { value: "every_friday_4pm", label: "Every Friday at 4:00 PM", cron: "0 16 * * 5" },
  { value: "first_of_month_9am", label: "1st of every month at 9:00 AM", cron: "0 9 1 * *" },
  { value: "custom", label: "Custom schedule", cron: "" },
];

function getPresetLabel(preset: string): string {
  return SCHEDULE_PRESETS.find((p) => p.value === preset)?.label || preset;
}

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
   Scheduled Task Form
   ============================================ */

function TaskForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: ScheduledTask;
  onSave: (data: { name: string; schedule_preset: string; cron_expression: string; agent_prompt: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [preset, setPreset] = useState(initial?.schedule_preset || "every_day_9am");
  const [customCron, setCustomCron] = useState(
    initial?.schedule_preset === "custom" ? initial.cron_expression : ""
  );
  const [prompt, setPrompt] = useState(initial?.agent_prompt || "");

  const handleSubmit = () => {
    const selectedPreset = SCHEDULE_PRESETS.find((p) => p.value === preset);
    const cronExpr = preset === "custom" ? customCron : (selectedPreset?.cron || "");
    onSave({ name: name.trim(), schedule_preset: preset, cron_expression: cronExpr, agent_prompt: prompt.trim() });
  };

  const isValid = name.trim().length > 0 && prompt.trim().length > 0 &&
    (preset !== "custom" || customCron.trim().length > 0);

  return (
    <div className="space-y-4 p-4 bg-background/50 rounded-lg border border-border">
      <div>
        <label htmlFor="task_name" className="block text-sm font-medium text-foreground mb-1.5">
          Task Name
        </label>
        <input
          type="text"
          id="task_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g., Weekly budget review"
          className="w-full max-w-sm px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
          disabled={isSaving}
        />
      </div>

      <div>
        <label htmlFor="task_schedule" className="block text-sm font-medium text-foreground mb-1.5">
          Schedule
        </label>
        <select
          id="task_schedule"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
          disabled={isSaving}
        >
          {SCHEDULE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {preset === "custom" && (
          <div className="mt-2">
            <input
              type="text"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="e.g., 0 9 * * 1 (cron expression)"
              className="w-full max-w-sm px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50 font-mono"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Standard cron format: minute hour day month weekday
            </p>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="task_prompt" className="block text-sm font-medium text-foreground mb-1.5">
          Agent Instructions
        </label>
        <textarea
          id="task_prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="e.g., Review all events in the next 14 days. Flag any that are over budget or have overdue checklist items. Summarize findings."
          className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors resize-y min-h-[80px] disabled:opacity-50"
          disabled={isSaving}
        />
        <p className="text-xs text-muted-foreground mt-1">
          What the agent should do when this task runs.
          {prompt.length > 0 && (
            <span className="ml-2 text-spectral">{prompt.length}/2000</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={!isValid || isSaving} isLoading={isSaving}>
          {initial ? "Update Task" : "Create Task"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ============================================
   Main Page Component
   ============================================ */

export default function AgentSettingsPage() {
  // --- Agent settings state ---
  const [settings, setSettings] = useState<AgentSettingsData>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<AgentSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- Collapsible sections ---
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    identity: false,
    heartbeat: false,
    notifications: false,
    scheduled: false,
  });

  const toggleSection = (key: SectionKey) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  // --- Scheduled tasks state ---
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [taskSaving, setTaskSaving] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const hasChanges =
    originalSettings &&
    (settings.agent_name !== originalSettings.agent_name ||
      settings.agent_focus !== originalSettings.agent_focus ||
      settings.heartbeat_enabled !== originalSettings.heartbeat_enabled ||
      settings.heartbeat_time !== originalSettings.heartbeat_time ||
      settings.notification_channel !== originalSettings.notification_channel);

  /* ---------- Fetch agent settings ---------- */
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
      setError(err instanceof Error ? err.message : "Failed to load agent settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ---------- Fetch scheduled tasks ---------- */
  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    setTaskError(null);
    try {
      const res = await fetch("/api/agent/cron-jobs");
      if (!res.ok) throw new Error("Failed to fetch scheduled tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to load scheduled tasks");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchTasks();
  }, [fetchSettings, fetchTasks]);

  /* ---------- Save agent settings ---------- */
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
      setError(err instanceof Error ? err.message : "Failed to save agent settings");
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

  /* ---------- Scheduled task CRUD ---------- */
  const handleCreateTask = async (data: { name: string; schedule_preset: string; cron_expression: string; agent_prompt: string }) => {
    setTaskSaving(true);
    setTaskError(null);
    try {
      const res = await fetch("/api/agent/cron-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create task");
      }
      const d = await res.json();
      setTasks((prev) => [...prev, d.task]);
      setShowTaskForm(false);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setTaskSaving(false);
    }
  };

  const handleUpdateTask = async (data: { name: string; schedule_preset: string; cron_expression: string; agent_prompt: string }) => {
    if (!editingTask) return;
    setTaskSaving(true);
    setTaskError(null);
    try {
      const res = await fetch(`/api/agent/cron-jobs/${editingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to update task");
      }
      const d = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? d.task : t)));
      setEditingTask(null);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setTaskSaving(false);
    }
  };

  const handleToggleTask = async (task: ScheduledTask) => {
    try {
      const res = await fetch(`/api/agent/cron-jobs/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle task");
      const d = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? d.task : t)));
    } catch {
      setTaskError("Failed to toggle task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setDeletingTaskId(taskId);
    setTaskError(null);
    try {
      const res = await fetch(`/api/agent/cron-jobs/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setDeletingTaskId(null);
    }
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
            onClick={() => { fetchSettings(); fetchTasks(); }}
            disabled={isLoading || isSaving}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
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

          {/* ========== Agent Identity ========== */}
          <Card>
            <SectionHeader
              icon={<Bot className="w-5 h-5" />}
              title="Agent Identity"
              description="Customize how the AI agent presents itself"
              collapsed={collapsed.identity}
              onToggle={() => toggleSection("identity")}
            />
            {!collapsed.identity && (
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="agent_name" className="block text-sm font-medium text-foreground mb-1.5">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    id="agent_name"
                    value={settings.agent_name}
                    onChange={(e) => setSettings((prev) => ({ ...prev, agent_name: e.target.value }))}
                    maxLength={50}
                    placeholder="Ghostly"
                    className="w-full max-w-sm px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The name shown in the chat panel header and messages.
                  </p>
                </div>
                <div>
                  <label htmlFor="agent_focus" className="block text-sm font-medium text-foreground mb-1.5">
                    Agent Focus / Custom Instructions
                  </label>
                  <textarea
                    id="agent_focus"
                    value={settings.agent_focus}
                    onChange={(e) => setSettings((prev) => ({ ...prev, agent_focus: e.target.value }))}
                    maxLength={2000}
                    rows={4}
                    placeholder="e.g., Focus on Q2 events and flag any expenses over $5,000. Always suggest budget reallocation when events are over budget."
                    className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors resize-y min-h-[100px] disabled:opacity-50"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Custom instructions that shape how the agent responds. These are added to the system prompt for every conversation.
                    {settings.agent_focus.length > 0 && (
                      <span className="ml-2 text-spectral">{settings.agent_focus.length}/2000</span>
                    )}
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* ========== Daily Heartbeat ========== */}
          <Card>
            <SectionHeader
              icon={<Clock className="w-5 h-5" />}
              title="Daily Heartbeat"
              description="Get a daily summary of events, overdue tasks, and budget alerts"
              collapsed={collapsed.heartbeat}
              onToggle={() => toggleSection("heartbeat")}
            />
            {!collapsed.heartbeat && (
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Enable Daily Heartbeat</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Receive an automated daily briefing from your agent
                    </p>
                  </div>
                  <button
                    onClick={() => setSettings((prev) => ({ ...prev, heartbeat_enabled: !prev.heartbeat_enabled }))}
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
                {settings.heartbeat_enabled && (
                  <div>
                    <label htmlFor="heartbeat_time" className="block text-sm font-medium text-foreground mb-1.5">
                      Delivery Time
                    </label>
                    <input
                      type="time"
                      id="heartbeat_time"
                      value={settings.heartbeat_time}
                      onChange={(e) => setSettings((prev) => ({ ...prev, heartbeat_time: e.target.value }))}
                      className="w-40 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors disabled:opacity-50"
                      disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Time in your local timezone when the daily briefing is sent.
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* ========== Scheduled Tasks ========== */}
          <Card>
            <SectionHeader
              icon={<CalendarClock className="w-5 h-5" />}
              title="Scheduled Tasks"
              description="Automate recurring agent tasks on a schedule (cron jobs)"
              collapsed={collapsed.scheduled}
              onToggle={() => toggleSection("scheduled")}
            />
            {!collapsed.scheduled && (
              <CardContent className="space-y-4">
                {/* Task error */}
                {taskError && (
                  <div className="flex items-center gap-3 p-3 bg-red-400/10 border border-destructive/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                    <p className="text-sm text-destructive">{taskError}</p>
                    <button onClick={() => setTaskError(null)} className="ml-auto text-destructive/60 hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Task list */}
                {tasksLoading ? (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading scheduled tasks...</span>
                  </div>
                ) : tasks.length === 0 && !showTaskForm ? (
                  <div className="text-center py-8">
                    <CalendarClock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">No scheduled tasks yet</p>
                    <p className="text-xs text-muted-foreground/70">
                      Create a task to have the agent automatically run on a schedule.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) =>
                      editingTask?.id === task.id ? (
                        <TaskForm
                          key={task.id}
                          initial={task}
                          onSave={handleUpdateTask}
                          onCancel={() => setEditingTask(null)}
                          isSaving={taskSaving}
                        />
                      ) : (
                        <div
                          key={task.id}
                          className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                            task.enabled
                              ? "border-border bg-background/50"
                              : "border-border/50 bg-background/20 opacity-60"
                          }`}
                        >
                          {/* Toggle */}
                          <button
                            onClick={() => handleToggleTask(task)}
                            className={`
                              relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full mt-0.5
                              border-2 border-transparent transition-colors duration-200 ease-in-out
                              focus:outline-none focus:ring-2 focus:ring-spectral/50
                              ${task.enabled ? "bg-spectral" : "bg-border"}
                            `}
                            role="switch"
                            aria-checked={task.enabled}
                            aria-label={`Toggle ${task.name}`}
                          >
                            <span
                              className={`
                                pointer-events-none inline-block h-4 w-4 transform rounded-full
                                bg-white shadow ring-0 transition duration-200 ease-in-out
                                ${task.enabled ? "translate-x-4" : "translate-x-0"}
                              `}
                            />
                          </button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {task.name}
                              </p>
                            </div>
                            <p className="text-xs text-spectral mt-0.5">
                              {getPresetLabel(task.schedule_preset)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.agent_prompt}
                            </p>
                            {task.last_run_at && (
                              <p className="text-xs text-muted-foreground/60 mt-1">
                                Last run: {new Date(task.last_run_at).toLocaleString()}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => { setEditingTask(task); setShowTaskForm(false); }}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-spectral/10 transition-colors"
                              title="Edit task"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              disabled={deletingTaskId === task.id}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Create form */}
                {showTaskForm && !editingTask && (
                  <TaskForm
                    onSave={handleCreateTask}
                    onCancel={() => setShowTaskForm(false)}
                    isSaving={taskSaving}
                  />
                )}

                {/* Add button */}
                {!showTaskForm && !editingTask && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShowTaskForm(true); setEditingTask(null); }}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Add Scheduled Task
                  </Button>
                )}
              </CardContent>
            )}
          </Card>

          {/* ========== Notifications ========== */}
          <Card>
            <SectionHeader
              icon={<Bell className="w-5 h-5" />}
              title="Notifications"
              description="Where the agent sends alerts and heartbeat summaries"
              collapsed={collapsed.notifications}
              onToggle={() => toggleSection("notifications")}
            />
            {!collapsed.notifications && (
              <CardContent>
                <div>
                  <label htmlFor="notification_channel" className="block text-sm font-medium text-foreground mb-1.5">
                    Notification Channel
                  </label>
                  <select
                    id="notification_channel"
                    value={settings.notification_channel}
                    onChange={(e) => setSettings((prev) => ({ ...prev, notification_channel: e.target.value }))}
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
            )}
          </Card>

          {/* ========== Save Actions ========== */}
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
              <Button variant="secondary" onClick={handleReset} disabled={!hasChanges || isSaving}>
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

          {/* ========== Info Card ========== */}
          <Card className="border-dashed">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-spectral/10 rounded-lg">
                  <Bot className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">About the AI Agent</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The Ghostly AI agent can query your events, track budgets, find overdue tasks,
                    create expenses, and help manage your event portfolio. Use the floating chat
                    button on any page to start a conversation. Custom instructions help the agent
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
