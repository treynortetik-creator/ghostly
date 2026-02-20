"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Calendar, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { Card, CardContent } from "@/components/ui/Card";
import { EventList } from "@/components/events/EventList";
import { EventForm, EventFormData } from "@/components/events/EventForm";
import type { EventWithTotals } from "@/types/database";

/* ============================================
   EVENTS LIST PAGE
   ============================================
   Main events management page showing all events
   with filtering, search, and add functionality.
   Victorian theme: "The Event Ledger"
   ============================================ */

interface EventsApiResponse {
  events: EventWithTotals[];
  meta: {
    total: number;
    filters_applied: Record<string, string>;
  };
}

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventWithTotals[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toasts, removeToast, toast } = useToast();

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
    <AppShell data-oid="6ks2gaf">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        data-oid="wa.lzf9"
      >
        <div data-oid="hsjmlip">
          <h1
            className="text-3xl font-serif font-bold text-wood-dark flex items-center gap-3"
            data-oid="qfgfujw"
          >
            <Calendar className="w-8 h-8 text-ink-gold" data-oid="0s4j:z." />
            The Event Ledger
          </h1>
          <p className="mt-1 text-sepia" data-oid="3-0ey.i">
            FY 2026 Events &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3" data-oid="tie.4j9">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEvents}
            disabled={isLoading}
            data-oid="in34b05"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              data-oid="jvqimi-"
            />
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
            leftIcon={<Plus className="w-4 h-4" data-oid="2ompy-i" />}
            data-oid=":s7-a3n"
          >
            Add Event
          </Button>
        </div>
      </div>

      {/* Create Event Form (Modal-like) */}
      {showCreateForm && (
        <div className="mb-8" data-oid="n-ina1r">
          <EventForm
            mode="create"
            onSubmit={handleCreateEvent}
            onCancel={() => setShowCreateForm(false)}
            isLoading={isCreating}
            data-oid="m1jdotw"
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
        data-oid="tggnq1d"
      />

      {/* Footer Info */}
      {!isLoading && !error && events.length > 0 && (
        <div
          className="text-center py-6 mt-8 border-t border-wood-medium/20"
          data-oid="qf.l20z"
        >
          <p className="text-xs text-sepia/60" data-oid="f15.15f">
            Click on any event to view full details and manage expenses.
          </p>
        </div>
      )}
    </AppShell>
  );
}
