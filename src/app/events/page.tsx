"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Calendar, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { EventList } from "@/components/events/EventList";
import { EventForm, EventFormData } from "@/components/events/EventForm";
import type { EventWithTotals, QuarterType } from "@/types/database";

/* ============================================
   EVENTS LIST PAGE
   ============================================
   Main events management page showing all events
   with filtering, search, and add functionality.
   Ghostly theme: "The Event Ledger"
   ============================================ */

interface EventsApiResponse {
  events: EventWithTotals[];
  meta: {
    total: number;
    filters_applied: Record<string, string>;
  };
}

function EventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventWithTotals[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toasts, removeToast, toast } = useToast();

  // Read initial filter values from URL search params
  const initialTypeId = searchParams.get("type") || "all";
  const initialQuarter = (searchParams.get("quarter") || "all") as QuarterType | "all";
  const initialSearch = searchParams.get("search") || "";

  // Sync filter changes to URL search params
  const handleFiltersChange = useCallback(
    (filters: { typeId: string | "all"; quarter: QuarterType | "all"; search: string }) => {
      const params = new URLSearchParams();
      if (filters.typeId !== "all") params.set("type", filters.typeId);
      if (filters.quarter !== "all") params.set("quarter", filters.quarter);
      if (filters.search) params.set("search", filters.search);

      const queryString = params.toString();
      router.replace(queryString ? `/events?${queryString}` : "/events", { scroll: false });
    },
    [router],
  );

  // Fetch events
  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all events (API defaults to 50; request up to 200)
      const response = await fetch("/api/events?per_page=200");
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      const data: EventsApiResponse = await response.json();
      setEvents(data.events);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Handle create event
  const handleCreateEvent = async (formData: EventFormData) => {
    setIsCreating(true);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create event");
      }

      const newEvent = await response.json();

      // Add to local state (in real app, would refetch)
      setEvents((prev) => [newEvent, ...prev]);
      setShowCreateForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setIsCreating(false);
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
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Calendar className="w-8 h-8 text-spectral" />
            The Event Ledger
          </h1>
          <p className="mt-1 text-muted-foreground">
            FY {new Date().getFullYear()} Events &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEvents}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Event
          </Button>
        </div>
      </div>

      {/* Create Event Form (Modal-like) */}
      {showCreateForm && (
        <div className="mb-8">
          <EventForm
            mode="create"
            onSubmit={handleCreateEvent}
            onCancel={() => setShowCreateForm(false)}
            isLoading={isCreating}
          />
        </div>
      )}

      {/* Events List */}
      <EventList
        events={events}
        isLoading={isLoading}
        error={error}
        expandable={false}
        showSearch={true}
        groupByQuarter={false}
        initialTypeId={initialTypeId}
        initialQuarter={initialQuarter}
        initialSearch={initialSearch}
        onFiltersChange={handleFiltersChange}
        selectable={true}
        onBulkActionComplete={fetchEvents}
      />

      {/* Footer Info */}
      {!isLoading && !error && events.length > 0 && (
        <div className="text-center py-6 mt-8 border-t border-border">
          <p className="text-xs text-muted-foreground/60">
            Click on any event to view full details and manage expenses.
          </p>
        </div>
      )}
    </AppShell>
  );
}

export default function EventsPage() {
  return (
    <Suspense>
      <EventsPageContent />
    </Suspense>
  );
}
