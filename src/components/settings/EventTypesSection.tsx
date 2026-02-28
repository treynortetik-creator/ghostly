"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, MoreVertical, Pencil, Archive, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { EventTypeForm, EventTypeFormData } from "./EventTypeForm";
import { formatCurrencyCompact } from "@/lib/format";
import type { EventTypeWithTotals } from "@/types/database";

/* ============================================
   EVENT TYPES SECTION COMPONENT
   ============================================
   Section component for managing event types
   on the Settings page. Handles listing, creating,
   editing, and archiving event types.
   Ghostly theme: "The Category Registry"
   ============================================ */

interface EventTypesSectionProps {
  fiscalYearId: string;
  disabled?: boolean;
}

export function EventTypesSection({
  fiscalYearId,
  disabled = false,
}: EventTypesSectionProps) {
  const [eventTypes, setEventTypes] = useState<EventTypeWithTotals[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState<EventTypeWithTotals | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const { toasts, removeToast, toast } = useToast();

  /**
   * Fetch event types from the API
   */
  const fetchEventTypes = useCallback(async () => {
    if (!fiscalYearId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/event-types?fiscal_year_id=${fiscalYearId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch event types");
      const data = await response.json();
      setEventTypes(data.event_types || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load event types",
      );
    } finally {
      setIsLoading(false);
    }
  }, [fiscalYearId]);

  useEffect(() => {
    fetchEventTypes();
  }, [fetchEventTypes]);

  /**
   * Handle creating a new event type
   */
  const handleCreate = async (data: EventTypeFormData) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          fiscal_year_id: fiscalYearId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create event type");
      }

      setShowForm(false);
      fetchEventTypes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event type");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle updating an existing event type
   */
  const handleUpdate = async (data: EventTypeFormData) => {
    if (!editingType) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/event-types/${editingType.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update event type");
      }

      setEditingType(null);
      fetchEventTypes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update event type");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle archiving an event type
   */
  const handleArchive = async (id: string) => {
    try {
      const response = await fetch(`/api/event-types/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to archive event type");
      }

      fetchEventTypes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to archive event type",
      );
    }
    setArchiveConfirmId(null);
    setOpenMenu(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only close if clicking outside the menu
      const target = e.target as HTMLElement;
      if (!target.closest("[data-menu-container]")) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Show create form
  if (showForm) {
    return (
      <EventTypeForm
        onSubmit={handleCreate}
        onCancel={() => setShowForm(false)}
        isLoading={isSaving}
        mode="create"
       
      />
    );
  }

  // Show edit form
  if (editingType) {
    return (
      <EventTypeForm
        eventType={editingType}
        onSubmit={handleUpdate}
        onCancel={() => setEditingType(null)}
        isLoading={isSaving}
        mode="edit"
       
      />
    );
  }

  return (
    <>
    <ToastContainer toasts={toasts} removeToast={removeToast} />
    <ConfirmDialog
      open={archiveConfirmId !== null}
      title="Archive Event Type"
      message="Archive this event type? It will no longer appear in dropdowns but existing events will keep their association."
      variant="warning"
      confirmLabel="Archive"
      onConfirm={() => { if (archiveConfirmId) handleArchive(archiveConfirmId); }}
      onCancel={() => setArchiveConfirmId(null)}
    />
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-md bg-spectral/10 text-spectral"
             
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Event Type Budgets</CardTitle>
              <CardDescription>
                Budget allocations by event category for the selected fiscal
                year
              </CardDescription>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowForm(true)}
            disabled={disabled || !fiscalYearId}
            leftIcon={<Plus className="w-4 h-4" />}
           
          >
            Add Type
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            Loading event types...
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && eventTypes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No event types configured for this fiscal year.
          </div>
        )}

        {!isLoading && !error && eventTypes.length > 0 && (
          <div className="space-y-2">
            {eventTypes.map((et) => (
              <div
                key={et.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-border transition-colors group"
               
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-medium text-foreground"
                     
                    >
                      {et.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({et.event_count} event{et.event_count !== 1 ? "s" : ""})
                    </span>
                  </div>
                  {et.description && (
                    <p
                      className="text-xs text-muted-foreground truncate"
                     
                    >
                      {et.description}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p
                    className="font-medium text-spectral tabular-nums"
                   
                  >
                    {formatCurrencyCompact(et.budget_amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrencyCompact(et.actual_spent)} spent
                  </p>
                </div>

                <div
                  className="relative"
                  data-menu-container
                 
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === et.id ? null : et.id);
                    }}
                    className="p-1.5 rounded hover:bg-spectral/10 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={disabled}
                    aria-expanded={openMenu === et.id}
                    aria-haspopup="true"
                    aria-label={`Actions for ${et.name}`}
                   
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {openMenu === et.id && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1 w-36 bg-background border border-border rounded-lg shadow-lg z-50"
                     
                    >
                      <button
                        role="menuitem"
                        onClick={() => {
                          setEditingType(et);
                          setOpenMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-spectral-light/30 rounded-t-lg transition-colors"
                       
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setArchiveConfirmId(et.id);
                          setOpenMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-red-400/10 rounded-b-lg transition-colors"
                       
                      >
                        <Archive className="w-4 h-4" />
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}

export default EventTypesSection;
