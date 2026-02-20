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
  executive: "bg-ink-gold/15 text-ink-gold border-ink-gold/30",
  national: "bg-ink-green/15 text-ink-green border-ink-green/30",
  state: "bg-wood-medium/15 text-wood-dark border-wood-medium/30",
  regional: "bg-sepia/15 text-sepia border-sepia/30",
  customer: "bg-ink-red/15 text-ink-red border-ink-red/30",
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
      <AppShell data-oid="i.8vn8g">
        <div className="animate-pulse space-y-6" data-oid="j::dphg">
          <div
            className="h-8 w-32 bg-wood-medium/10 rounded"
            data-oid="g6l1vkk"
          />
          <div
            className="h-64 bg-wood-medium/10 rounded-lg"
            data-oid="uf--wh:"
          />
          <div
            className="h-48 bg-wood-medium/10 rounded-lg"
            data-oid="xnpc8j0"
          />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <AppShell data-oid="y5xt1z:">
        <Card className="bg-ink-red/5 border-ink-red/20" data-oid="zz34g1i">
          <CardContent className="py-12" data-oid="a72r24.">
            <div
              className="flex flex-col items-center justify-center text-center"
              data-oid="eiy00uh"
            >
              <AlertTriangle
                className="w-12 h-12 text-ink-red mb-4"
                data-oid="dl:7ex5"
              />
              <h3
                className="font-serif text-xl font-semibold text-ink-red mb-2"
                data-oid="ifew_:t"
              >
                {error || "Event Not Found"}
              </h3>
              <p className="text-sepia mb-6" data-oid="rv-c:t7">
                The requested event could not be loaded.
              </p>
              <Link href="/events" data-oid="vh0.bqz">
                <Button variant="secondary" data-oid=":z.3510">
                  <ArrowLeft className="w-4 h-4 mr-2" data-oid="6a.s_qt" />
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
      <AppShell data-oid="o6xod29">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div className="mb-6" data-oid="lkjjng2">
          <Link
            href="/events"
            className="inline-flex items-center text-sm text-sepia hover:text-wood-dark transition-colors"
            data-oid="z-wlt:r"
          >
            <ArrowLeft className="w-4 h-4 mr-1" data-oid="aw_w2_k" />
            Back to Events
          </Link>
        </div>

        <EventForm
          event={event}
          mode="edit"
          onSubmit={handleUpdateEvent}
          onCancel={() => setIsEditing(false)}
          isLoading={isSaving}
          data-oid=".lujdi3"
        />
      </AppShell>
    );
  }

  return (
    <AppShell data-oid="jek1nsg">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Back link */}
      <div className="mb-6" data-oid="k8df1j-">
        <Link
          href="/events"
          className="inline-flex items-center text-sm text-sepia hover:text-wood-dark transition-colors"
          data-oid="0v0v.8a"
        >
          <ArrowLeft className="w-4 h-4 mr-1" data-oid="jxj6fw." />
          Back to Events
        </Link>
      </div>

      {/* Event Header */}
      <div
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8"
        data-oid="iqqnr3m"
      >
        <div data-oid="jhmgbdy">
          <div
            className="flex flex-wrap items-center gap-3 mb-2"
            data-oid="i74nzsv"
          >
            <h1
              className="text-3xl font-serif font-bold text-wood-dark"
              data-oid="blt_s1t"
            >
              {event.name}
            </h1>
            <span
              className={`
                inline-flex items-center px-3 py-1 rounded text-sm font-medium border
                ${typeColorClasses[event.event_type_record?.name?.toLowerCase() ?? ''] || 'bg-sepia/15 text-sepia border-sepia/30'}
              `}
              data-oid="r3culeu"
            >
              {event.event_type_record?.name ?? 'Uncategorized'}
            </span>
            <span
              className="text-sm font-medium text-sepia bg-parchment-dark px-3 py-1 rounded border border-wood-medium/20"
              data-oid="3-vigbk"
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
              <span className="inline-flex items-center bg-parchment-dark text-sepia border border-wood-medium/30 rounded-full px-2 py-0.5 text-xs">
                {eventStageLabels[event.stage]}
              </span>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-4 text-sepia"
            data-oid="e_5o6fb"
          >
            <span
              className="inline-flex items-center gap-1.5"
              data-oid="lix1uus"
            >
              <Calendar className="w-4 h-4" data-oid="v7l-5k_" />
              {formatDateRange()}
            </span>
            {event.location && (
              <span
                className="inline-flex items-center gap-1.5"
                data-oid="qut1vrc"
              >
                <MapPin className="w-4 h-4" data-oid="t_ort:r" />
                {event.location}
              </span>
            )}
            {event.shipping_handler && (
              <span className="inline-flex items-center gap-1 text-xs text-sepia/60">
                <Truck className="w-3.5 h-3.5" />
                {event.shipping_handler === 'handler_a' ? 'Handler A' : 'Handler B'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2" data-oid="73vv3mf">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchEvent}
            data-oid="-efdx9d"
          >
            <RefreshCw className="w-4 h-4 mr-2" data-oid="m.kmj6j" />
            Refresh
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            leftIcon={<Edit className="w-4 h-4" data-oid="hwomj_4" />}
            data-oid="8jm-kj6"
          >
            Edit
          </Button>

          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            leftIcon={<Trash2 className="w-4 h-4" data-oid="1c96hm-" />}
            data-oid="vjmhznb"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Card
          className="mb-6 bg-ink-red/5 border-ink-red/30"
          data-oid="c5y917:"
        >
          <CardContent className="py-4" data-oid="xocwg48">
            <div
              className="flex items-center justify-between"
              data-oid=".q5bv4d"
            >
              <div className="flex items-center gap-3" data-oid="vm0h9_f">
                <AlertTriangle
                  className="w-5 h-5 text-ink-red"
                  data-oid="9_koao_"
                />
                <div data-oid="oki76:_">
                  <p className="font-medium text-ink-black" data-oid="bgh_1vc">
                    Are you sure you want to delete this event?
                  </p>
                  <p className="text-sm text-sepia" data-oid="wr4nlzl">
                    This action can be undone by an administrator.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2" data-oid="7i_s3zw">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  data-oid="wlr2aqi"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteEvent}
                  isLoading={isDeleting}
                  data-oid="nt181_3"
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
        className="flex gap-1 mb-6 border-b border-wood-medium/20"
        data-oid="_c-kyax"
      >
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "details"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="e3a4d:."
        >
          <DollarSign
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
            data-oid="cg0x.6n"
          />
          Budget &amp; Details
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "documents"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="doc-tab"
        >
          <Paperclip
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
            data-oid="doc-ico"
          />
          Documents
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "team"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="nx3_n-a"
        >
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" data-oid="0t42yf8" />
          Team
        </button>
        <button
          onClick={() => setActiveTab("checklist")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "checklist"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="sm:_6w3"
        >
          <FileText
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
            data-oid="5.d-_24"
          />
          Checklist
        </button>
        <button
          onClick={() => setActiveTab("reminders")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "reminders"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="rmnd-tab"
        >
          <Bell
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
            data-oid="rmnd-ico"
          />
          Reminders
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "notes"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="note-tab"
        >
          <MessageSquare
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
            data-oid="note-ico"
          />
          Notes
        </button>
        <button
          onClick={() => setActiveTab("shipments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "shipments"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="ship-tab"
        >
          <Package
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
            data-oid="ship-ico"
          />
          Shipments
        </button>
        <button
          onClick={() => setActiveTab("post_event")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "post_event"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="post-tab"
        >
          <ClipboardCheck
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
            data-oid="post-ico"
          />
          Post-Event
        </button>
        <button
          onClick={() => setActiveTab("roi")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "roi"
              ? "border-ink-gold text-ink-gold"
              : "border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40"
          }`}
          data-oid="ajspqtn"
        >
          <TrendingUp
            className="w-4 h-4 inline mr-1.5 -mt-0.5"
            data-oid="x1h9yu8"
          />
          ROI Tracking
        </button>
      </div>

      {/* Documents Tab */}
      {activeTab === "documents" && <EventDocumentsTab eventId={id} />}

      {/* Team Tab */}
      {activeTab === "team" && <EventTeamTab eventId={id} data-oid=":q0a1fv" />}

      {/* Checklist Tab */}
      {activeTab === "checklist" && (
        <EventChecklistTab eventId={id} tier={event.tier} data-oid="o:oscvv" />
      )}

      {/* Reminders Tab */}
      {activeTab === "reminders" && (
        <EventRemindersTab eventId={id} eventDateStart={event.date_start} />
      )}

      {/* Notes Tab */}
      {activeTab === "notes" && <EventNotesTab eventId={id} />}

      {/* Shipments Tab */}
      {activeTab === "shipments" && <EventShipmentsTab eventId={id} />}

      {/* Post-Event Tab */}
      {activeTab === "post_event" && <EventPostEventTab eventId={id} />}

      {/* ROI Tab */}
      {activeTab === "roi" && (
        <EventROITab event={event} onEventUpdated={fetchEvent} />
      )}

      {/* Details Tab */}
      {activeTab === "details" && (
        <EventDetailsTab event={event} expenses={expenses} />
      )}
    </AppShell>
  );
}
