"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  AlertTriangle,
  RefreshCw,
  FileText,
  DollarSign,
  TrendingUp,
  Users,
  Bell,
  MessageSquare,
  Paperclip,
  Package,
  ClipboardCheck,
  Truck,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import {
  Card,
  CardContent,
} from "@/components/ui/Card";
import { EventForm, EventFormData } from "@/components/events/EventForm";
import { EventTeamTab } from "@/components/events/EventTeamTab";
import { EventChecklistTab } from "@/components/events/EventChecklistTab";
import { EventRemindersTab } from "@/components/events/EventRemindersTab";
import { EventNotesTab } from "@/components/events/EventNotesTab";
import { EventShipmentsTab } from "@/components/events/EventShipmentsTab";
import { EventPostEventTab } from "@/components/events/EventPostEventTab";
import { EventDocumentsTab } from "@/components/documents/EventDocumentsTab";
import { EventROITab } from "@/components/events/EventROITab";
import { EventDetailsTab } from "@/components/events/EventDetailsTab";
import { formatDateLong } from "@/lib/format";
import type { Expense, FiscalYear, EventWithTotals, EventTier } from "@/types/database";
import { tierColors, eventTierLabels, eventStageLabels } from "@/types/database";

/* ============================================
   EVENT DETAIL PAGE
   ============================================
   Shows full event details with:
   - Event information
   - Budget progress
   - Linked expenses
   - Edit and delete functionality
   ============================================ */

interface EventDetailApiResponse {
  event: EventWithTotals;
  expenses: Expense[];
  fiscal_year: FiscalYear;
}

const typeColorClasses: Record<string, string> = {
  executive: "bg-spectral/10 text-spectral border-spectral",
  national: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  state: "bg-spectral/10 text-foreground border-border",
  regional: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  customer: "bg-red-400/10 text-destructive border-destructive/30",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EventDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<EventWithTotals | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toasts, removeToast, toast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "details" | "documents" | "team" | "checklist" | "reminders" | "notes" | "shipments" | "post_event" | "roi"
  >("details");
  // Fetch event details
  const fetchEvent = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Event not found");
        }
        throw new Error("Failed to fetch event");
      }
      const data: EventDetailApiResponse = await response.json();
      setEvent(data.event);
      setExpenses(data.expenses);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [id]);

  // Handle update event
  const handleUpdateEvent = async (formData: EventFormData) => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update event");
      }

      const updatedEvent = await response.json();
      setEvent(updatedEvent);
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete event
  const handleDeleteEvent = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete event");
      }

      router.push("/events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDateRange = () => {
    if (!event?.date_start) return "Dates to be determined";
    const start = formatDateLong(event.date_start);
    const end = event.date_end ? formatDateLong(event.date_end) : null;
    if (end && start !== end) {
      return `${start} - ${end}`;
    }
    return start;
  };

  // Loading state
  if (isLoading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-6">
          <div
            className="h-8 w-32 bg-spectral/10 rounded"
           
          />
          <div
            className="h-64 bg-spectral/10 rounded-lg"
           
          />
          <div
            className="h-48 bg-spectral/10 rounded-lg"
           
          />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <AppShell>
        <Card className="bg-red-400/10 border-destructive/20">
          <CardContent className="py-12">
            <div
              className="flex flex-col items-center justify-center text-center"
             
            >
              <AlertTriangle
                className="w-12 h-12 text-destructive mb-4"
               
              />
              <h3
                className="text-xl font-semibold text-destructive mb-2"
               
              >
                {error || "Event Not Found"}
              </h3>
              <p className="text-muted-foreground mb-6">
                The requested event could not be loaded.
              </p>
              <Link href="/events">
                <Button variant="secondary">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Events
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  // Edit mode
  if (isEditing) {
    return (
      <AppShell>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="mb-6">
          <Link
            href="/events"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
           
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Events
          </Link>
        </div>

        <EventForm
          event={event}
          mode="edit"
          onSubmit={handleUpdateEvent}
          onCancel={() => setIsEditing(false)}
          isLoading={isSaving}
         
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/events"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
         
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Events
        </Link>
      </div>

      {/* Event Header */}
      <div
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8"
       
      >
        <div>
          <div
            className="flex flex-wrap items-center gap-3 mb-2"
           
          >
            <h1
              className="text-3xl font-bold text-foreground"
             
            >
              {event.name}
            </h1>
            <span
              className={`
                inline-flex items-center px-3 py-1 rounded text-sm font-medium border
                ${typeColorClasses[event.event_type_record?.name?.toLowerCase() ?? ''] || 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30'}
              `}
             
            >
              {event.event_type_record?.name ?? 'Uncategorized'}
            </span>
            <span
              className="text-sm font-medium text-muted-foreground bg-card px-3 py-1 rounded border border-border"
             
            >
              {event.quarter}
            </span>
            {event.tier && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[event.tier as EventTier].bg} ${tierColors[event.tier as EventTier].text} border ${tierColors[event.tier as EventTier].border}`}
              >
                {eventTierLabels[event.tier as EventTier]}
              </span>
            )}
            {event.stage && (
              <span className="inline-flex items-center bg-card text-muted-foreground border border-border rounded-full px-2 py-0.5 text-xs">
                {eventStageLabels[event.stage]}
              </span>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-4 text-muted-foreground"
           
          >
            <span
              className="inline-flex items-center gap-1.5"
             
            >
              <Calendar className="w-4 h-4" />
              {formatDateRange()}
            </span>
            {event.location && (
              <span
                className="inline-flex items-center gap-1.5"
               
              >
                <MapPin className="w-4 h-4" />
                {event.location}
              </span>
            )}
            {event.shipping_handler && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                <Truck className="w-3.5 h-3.5" />
                {event.shipping_handler === 'handler_a' ? 'Handler A' : 'Handler B'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEvent}
           
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            leftIcon={<Edit className="w-4 h-4" />}
           
          >
            Edit
          </Button>

          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            leftIcon={<Trash2 className="w-4 h-4" />}
           
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card
          className="mb-6 bg-red-400/10 border-destructive/30"
         
        >
          <CardContent className="py-4">
            <div
              className="flex items-center justify-between"
             
            >
              <div className="flex items-center gap-3">
                <AlertTriangle
                  className="w-5 h-5 text-destructive"
                 
                />
                <div>
                  <p className="font-medium text-foreground">
                    Are you sure you want to delete this event?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This action can be undone by an administrator.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                 
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteEvent}
                  isLoading={isDeleting}
                 
                >
                  Delete Event
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation */}
      <div
        className="flex gap-1 mb-6 border-b border-border overflow-x-auto whitespace-nowrap"
        role="tablist"
        aria-label="Event sections"
       
      >
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "details"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "details"}
          aria-controls="panel-details"
          id="tab-details"
         
        >
          <DollarSign
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
           
          />
          Budget &amp; Details
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "documents"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "documents"}
          aria-controls="panel-documents"
          id="tab-documents"
         
        >
          <Paperclip
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
           
          />
          Documents
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "team"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "team"}
          aria-controls="panel-team"
          id="tab-team"
         
        >
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Team
        </button>
        <button
          onClick={() => setActiveTab("checklist")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "checklist"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "checklist"}
          aria-controls="panel-checklist"
          id="tab-checklist"
         
        >
          <FileText
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
           
          />
          Checklist
        </button>
        <button
          onClick={() => setActiveTab("reminders")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "reminders"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "reminders"}
          aria-controls="panel-reminders"
          id="tab-reminders"
         
        >
          <Bell
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
           
          />
          Reminders
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "notes"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "notes"}
          aria-controls="panel-notes"
          id="tab-notes"
         
        >
          <MessageSquare
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
           
          />
          Notes
        </button>
        <button
          onClick={() => setActiveTab("shipments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "shipments"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "shipments"}
          aria-controls="panel-shipments"
          id="tab-shipments"
         
        >
          <Package
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
           
          />
          Shipments
        </button>
        <button
          onClick={() => setActiveTab("post_event")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "post_event"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "post_event"}
          aria-controls="panel-post_event"
          id="tab-post_event"
         
        >
          <ClipboardCheck
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
           
          />
          Post-Event
        </button>
        <button
          onClick={() => setActiveTab("roi")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "roi"
              ? "border-spectral text-spectral"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
          role="tab"
          aria-selected={activeTab === "roi"}
          aria-controls="panel-roi"
          id="tab-roi"
         
        >
          <TrendingUp
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
           
          />
          ROI Tracking
        </button>
      </div>

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents">
          <EventDocumentsTab eventId={id} />
        </div>
      )}

      {/* Team Tab */}
      {activeTab === "team" && (
        <div role="tabpanel" id="panel-team" aria-labelledby="tab-team">
          <EventTeamTab eventId={id} />
        </div>
      )}

      {/* Checklist Tab */}
      {activeTab === "checklist" && (
        <div role="tabpanel" id="panel-checklist" aria-labelledby="tab-checklist">
          <EventChecklistTab eventId={id} tier={event.tier} />
        </div>
      )}

      {/* Reminders Tab */}
      {activeTab === "reminders" && (
        <div role="tabpanel" id="panel-reminders" aria-labelledby="tab-reminders">
          <EventRemindersTab eventId={id} eventDateStart={event.date_start} />
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === "notes" && (
        <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes">
          <EventNotesTab eventId={id} />
        </div>
      )}

      {/* Shipments Tab */}
      {activeTab === "shipments" && (
        <div role="tabpanel" id="panel-shipments" aria-labelledby="tab-shipments">
          <EventShipmentsTab eventId={id} />
        </div>
      )}

      {/* Post-Event Tab */}
      {activeTab === "post_event" && (
        <div role="tabpanel" id="panel-post_event" aria-labelledby="tab-post_event">
          <EventPostEventTab eventId={id} />
        </div>
      )}

      {/* ROI Tab */}
      {activeTab === "roi" && (
        <div role="tabpanel" id="panel-roi" aria-labelledby="tab-roi">
          <EventROITab event={event} onEventUpdated={fetchEvent} />
        </div>
      )}

      {/* Details Tab */}
      {activeTab === "details" && (
        <div role="tabpanel" id="panel-details" aria-labelledby="tab-details">
          <EventDetailsTab event={event} expenses={expenses} />
        </div>
      )}
    </AppShell>
  );
}
