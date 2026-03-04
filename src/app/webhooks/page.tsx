"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Webhook,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Zap,
  Globe,
  X,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { VALID_WEBHOOK_EVENT_TYPES } from "@/lib/validation";

/* ============================================
   WEBHOOKS MANAGEMENT PAGE
   ============================================
   Full CRUD page for webhook management.
   Ghostly theme: "The Signal Tower"
   ============================================ */

interface WebhookRecord {
  id: string;
  url: string;
  event_types: string[];
  secret: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: unknown;
  status: string;
  response_status: number | null;
  response_body: string | null;
  attempts: number;
  created_at: string;
}

interface WebhookWithDeliveries extends WebhookRecord {
  recent_deliveries?: WebhookDelivery[];
}

interface WebhookFormData {
  url: string;
  event_types: string[];
  secret: string;
  description: string;
  is_active: boolean;
}

const defaultFormData: WebhookFormData = {
  url: "",
  event_types: [],
  secret: "",
  description: "",
  is_active: true,
};

const EVENT_TYPE_OPTIONS: readonly string[] = VALID_WEBHOOK_EVENT_TYPES;

// Map event types to human-readable labels
const eventTypeLabels: Record<string, string> = {
  "expense.created": "Expense Created",
  "expense.updated": "Expense Updated",
  "expense.deleted": "Expense Deleted",
  "event.created": "Event Created",
  "event.updated": "Event Updated",
  "event.deleted": "Event Deleted",
  "budget.threshold_reached": "Budget Threshold",
  "*": "All Events",
};

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookRecord | null>(
    null,
  );
  const [formData, setFormData] = useState<WebhookFormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WebhookRecord | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<
    Record<string, WebhookDelivery[]>
  >({});
  const { toasts, removeToast, toast } = useToast();

  // Fetch all webhooks
  const fetchWebhooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/webhooks");
      if (!res.ok) throw new Error("Failed to fetch webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load webhooks",
      );
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  // Fetch deliveries for a specific webhook
  const fetchDeliveries = async (webhookId: string) => {
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`);
      if (!res.ok) return;
      const data: WebhookWithDeliveries = await res.json();
      setDeliveries((prev) => ({
        ...prev,
        [webhookId]: data.recent_deliveries || [],
      }));
    } catch {
      // Silently fail -- deliveries are not critical
    }
  };

  // Toggle expanded webhook card
  const toggleExpanded = (webhookId: string) => {
    if (expandedId === webhookId) {
      setExpandedId(null);
    } else {
      setExpandedId(webhookId);
      if (!deliveries[webhookId]) {
        fetchDeliveries(webhookId);
      }
    }
  };

  // Open form for creating
  const handleAdd = () => {
    setEditingWebhook(null);
    setFormData(defaultFormData);
    setShowForm(true);
  };

  // Open form for editing
  const handleEdit = (webhook: WebhookRecord) => {
    setEditingWebhook(webhook);
    setFormData({
      url: webhook.url,
      event_types: [...webhook.event_types],
      secret: webhook.secret || "",
      description: webhook.description || "",
      is_active: webhook.is_active,
    });
    setShowForm(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    // Basic validation
    if (!formData.url.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    if (formData.event_types.length === 0) {
      toast.error("At least one event type is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        url: formData.url.trim(),
        event_types: formData.event_types,
        secret: formData.secret || null,
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };

      const url = editingWebhook
        ? `/api/webhooks/${editingWebhook.id}`
        : "/api/webhooks";
      const method = editingWebhook ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save webhook");
      }

      toast.success(
        editingWebhook ? "Webhook updated" : "Webhook created",
      );
      setShowForm(false);
      setEditingWebhook(null);
      fetchWebhooks();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save webhook",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const webhook = deleteTarget;
    setDeleteTarget(null);

    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete webhook");
      toast.success("Webhook deleted");
      fetchWebhooks();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete webhook",
      );
    }
  };

  // Test webhook
  const handleTest = async (webhook: WebhookRecord) => {
    setTestingId(webhook.id);
    try {
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_id: webhook.id }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(
          `Test delivered (${data.response_status}) in ${data.latency_ms}ms`,
        );
      } else {
        toast.warning(
          `Test failed: ${data.response_body || "No response"}`,
        );
      }

      // Refresh deliveries if expanded
      if (expandedId === webhook.id) {
        fetchDeliveries(webhook.id);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to test webhook",
      );
    } finally {
      setTestingId(null);
    }
  };

  // Toggle event type in form
  const toggleEventType = (eventType: string) => {
    setFormData((prev) => {
      const types = prev.event_types.includes(eventType)
        ? prev.event_types.filter((t) => t !== eventType)
        : [...prev.event_types, eventType];
      return { ...prev, event_types: types };
    });
  };

  // Format timestamp
  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppShell>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Webhook"
        message={`Are you sure you want to delete the webhook for ${deleteTarget?.url || ""}? This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Webhook className="w-8 h-8 text-spectral" />
            The Signal Tower
          </h1>
          <p className="mt-1 text-muted-foreground">
            {webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""}{" "}
            configured
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchWebhooks}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Webhook
          </Button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <Card className="mb-8" glow>
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {editingWebhook ? "Edit Webhook" : "Add Webhook"}
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingWebhook(null);
                }}
                aria-label="Close form"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-5">
              {/* URL */}
              <div>
                <label
                  htmlFor="webhook-url"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Endpoint URL *
                </label>
                <input
                  id="webhook-url"
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="https://example.com/webhooks"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors duration-200"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="webhook-description"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Description
                </label>
                <input
                  id="webhook-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="What is this webhook for?"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors duration-200"
                />
              </div>

              {/* Event Types */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Event Types *
                </label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPE_OPTIONS.map((type) => {
                    const isSelected = formData.event_types.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleEventType(type)}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200
                          ${
                            isSelected
                              ? "bg-spectral/20 border-spectral/50 text-spectral"
                              : "bg-background border-border text-muted-foreground hover:border-spectral/30 hover:text-foreground"
                          }
                        `}
                      >
                        {eventTypeLabels[type] || type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secret */}
              <div>
                <label
                  htmlFor="webhook-secret"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Signing Secret
                </label>
                <input
                  id="webhook-secret"
                  type="text"
                  value={formData.secret}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      secret: e.target.value,
                    }))
                  }
                  placeholder="Optional HMAC signing secret"
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral transition-colors duration-200 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If set, payloads will be signed with HMAC-SHA256 in the
                  X-Webhook-Signature header.
                </p>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-border text-spectral focus:ring-spectral/50"
                />
                <span className="text-sm text-foreground">Active</span>
              </label>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingWebhook(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  isLoading={isSaving}
                >
                  {editingWebhook ? "Update Webhook" : "Create Webhook"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-spectral/10 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && webhooks.length === 0 && (
        <Card className="border-dashed">
          <CardContent>
            <EmptyState
              icon={<Webhook className="w-12 h-12" />}
              title="No Webhooks Configured"
              description="Set up webhooks to receive real-time notifications when events occur in Ghostly."
              action={
                <Button
                  variant="primary"
                  onClick={handleAdd}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Add First Webhook
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Webhook Cards */}
      {!isLoading && webhooks.length > 0 && (
        <div className="space-y-4">
          {webhooks.map((webhook) => {
            const isExpanded = expandedId === webhook.id;
            const webhookDeliveries = deliveries[webhook.id] || [];

            return (
              <Card key={webhook.id} elevated>
                <CardContent className="py-5">
                  {/* Main row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* URL and status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-mono text-foreground truncate max-w-md">
                          {webhook.url}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            webhook.is_active
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-red-400/10 text-red-400 border border-red-400/20"
                          }`}
                        >
                          {webhook.is_active ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {webhook.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Description */}
                      {webhook.description && (
                        <p className="text-sm text-muted-foreground">
                          {webhook.description}
                        </p>
                      )}

                      {/* Event type badges */}
                      <div className="flex flex-wrap gap-1.5">
                        {webhook.event_types.map((type) => (
                          <span
                            key={type}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-spectral/10 text-foreground border border-border"
                          >
                            {eventTypeLabels[type] || type}
                          </span>
                        ))}
                      </div>

                      {/* Created timestamp */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Created {formatTimestamp(webhook.created_at)}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTest(webhook)}
                        isLoading={testingId === webhook.id}
                        disabled={!webhook.is_active}
                      >
                        <Zap className="w-3.5 h-3.5 mr-1" />
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(webhook)}
                        aria-label="Edit webhook"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(webhook)}
                        aria-label="Delete webhook"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleExpanded(webhook.id)}
                        aria-label={
                          isExpanded
                            ? "Hide deliveries"
                            : "Show deliveries"
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded: Recent Deliveries */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h4 className="text-sm font-semibold text-foreground mb-3">
                        Recent Deliveries
                      </h4>
                      {webhookDeliveries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No deliveries recorded yet.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Status
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Event
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  HTTP
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Attempts
                                </th>
                                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Time
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {webhookDeliveries.map((delivery) => (
                                <tr
                                  key={delivery.id}
                                  className="hover:bg-card/30 transition-colors"
                                >
                                  <td className="py-2 px-3">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                        delivery.status === "delivered"
                                          ? "bg-emerald-500/10 text-emerald-500"
                                          : "bg-red-400/10 text-red-400"
                                      }`}
                                    >
                                      {delivery.status === "delivered" ? (
                                        <CheckCircle className="w-3 h-3" />
                                      ) : (
                                        <XCircle className="w-3 h-3" />
                                      )}
                                      {delivery.status}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-foreground">
                                    {delivery.event_type}
                                  </td>
                                  <td className="py-2 px-3 text-muted-foreground">
                                    {delivery.response_status || "N/A"}
                                  </td>
                                  <td className="py-2 px-3 text-muted-foreground">
                                    {delivery.attempts}
                                  </td>
                                  <td className="py-2 px-3 text-muted-foreground">
                                    {formatTimestamp(delivery.created_at)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 mt-8 border-t border-border">
        <p className="text-xs text-muted-foreground/60 italic">
          &ldquo;When the signal fires burn, all shall know.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
