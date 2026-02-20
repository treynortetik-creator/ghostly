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
  Target,
  Receipt,
  Plus,
  AlertTriangle,
  RefreshCw,
  FileText,
  DollarSign,
  TrendingUp,
  Users,
  Handshake,
  Briefcase,
  Save,
  Bell,
  MessageSquare,
  Paperclip,
  Package,
  ClipboardCheck,
  Truck,
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
  StatCard,
} from "@/components/ui/Card";
import { ProgressBar, BudgetProgress } from "@/components/ui/ProgressBar";
import { EventForm, EventFormData } from "@/components/events/EventForm";
import { EventTeamTab } from "@/components/events/EventTeamTab";
import { EventChecklistTab } from "@/components/events/EventChecklistTab";
import { EventRemindersTab } from "@/components/events/EventRemindersTab";
import { EventNotesTab } from "@/components/events/EventNotesTab";
import { EventShipmentsTab } from "@/components/events/EventShipmentsTab";
import { EventPostEventTab } from "@/components/events/EventPostEventTab";
import { EventDocumentsTab } from "@/components/documents/EventDocumentsTab";
import { formatCurrency, formatDateLong } from "@/lib/format";
import type { Expense, FiscalYear, EventWithTotals, EventTier, ShippingHandler } from "@/types/database";
import { eventTypeLabels, quarterLabels, tierColors, eventTierLabels, eventStageLabels } from "@/types/database";

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
  const [activeTab, setActiveTab] = useState<
    "details" | "documents" | "team" | "checklist" | "reminders" | "notes" | "shipments" | "post_event" | "roi"
  >("details");
  const [isEditingROI, setIsEditingROI] = useState(false);
  const [isSavingROI, setIsSavingROI] = useState(false);
  const [roiForm, setRoiForm] = useState({
    pipeline_generated: 0,
    revenue_closed: 0,
    leads_generated: 0,
    meetings_booked: 0,
    opportunities_created: 0,
    roi_notes: "",
  });

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

  // Sync ROI form when event loads
  useEffect(() => {
    if (event) {
      setRoiForm({
        pipeline_generated: event.pipeline_generated ?? 0,
        revenue_closed: event.revenue_closed ?? 0,
        leads_generated: event.leads_generated ?? 0,
        meetings_booked: event.meetings_booked ?? 0,
        opportunities_created: event.opportunities_created ?? 0,
        roi_notes: event.roi_notes ?? "",
      });
    }
  }, [event]);

  // Handle save ROI data
  const handleSaveROI = async () => {
    setIsSavingROI(true);
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roiForm),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update ROI data");
      }
      const updatedEvent = await response.json();
      setEvent(updatedEvent);
      setIsEditingROI(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save ROI data");
    } finally {
      setIsSavingROI(false);
    }
  };

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
      alert(err instanceof Error ? err.message : "Failed to update event");
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
      alert(err instanceof Error ? err.message : "Failed to delete event");
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

  // Compute ROI metrics
  const computeROIMetrics = () => {
    if (!event) return null;
    const spent = event.actual_spent;
    const revenue = event.revenue_closed ?? 0;
    const pipeline = event.pipeline_generated ?? 0;
    const leads = event.leads_generated ?? 0;
    const meetings = event.meetings_booked ?? 0;

    return {
      roi_ratio: spent > 0 ? (revenue - spent) / spent : null,
      cost_per_lead: leads > 0 ? spent / leads : null,
      cost_per_meeting: meetings > 0 ? spent / meetings : null,
      pipeline_to_spend_ratio: spent > 0 ? pipeline / spent : null,
    };
  };

  const roiMetrics = event ? computeROIMetrics() : null;

  const roiColor = (value: number | null) => {
    if (value === null) return "neutral" as const;
    if (value > 0.05) return "positive" as const;
    if (value < -0.05) return "negative" as const;
    return "neutral" as const;
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return "N/A";
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatRatio = (value: number | null) => {
    if (value === null) return "N/A";
    return `${value.toFixed(2)}x`;
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
        <div className="space-y-6" data-oid="fe-8f5d">
          {/* Computed ROI Metrics */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            data-oid="rbn9t.l"
          >
            <StatCard
              title="ROI Ratio"
              value={formatPercent(roiMetrics?.roi_ratio ?? null)}
              subtitle={
                roiMetrics?.roi_ratio !== null
                  ? roiMetrics!.roi_ratio > 0
                    ? "Positive return"
                    : roiMetrics!.roi_ratio < 0
                      ? "Negative return"
                      : "Break-even"
                  : "No spend data"
              }
              trend={roiColor(roiMetrics?.roi_ratio ?? null)}
              icon={<TrendingUp className="w-5 h-5" data-oid="1:nx4l_" />}
              data-oid="kyqcloh"
            />

            <StatCard
              title="Cost per Lead"
              value={
                roiMetrics?.cost_per_lead !== null
                  ? formatCurrency(roiMetrics!.cost_per_lead)
                  : "N/A"
              }
              subtitle={`${event.leads_generated ?? 0} leads captured`}
              icon={<Users className="w-5 h-5" data-oid="x5eww82" />}
              data-oid="t-5k11t"
            />

            <StatCard
              title="Cost per Meeting"
              value={
                roiMetrics?.cost_per_meeting !== null
                  ? formatCurrency(roiMetrics!.cost_per_meeting)
                  : "N/A"
              }
              subtitle={`${event.meetings_booked ?? 0} meetings booked`}
              icon={<Handshake className="w-5 h-5" data-oid="8md6g85" />}
              data-oid="apc9:xv"
            />

            <StatCard
              title="Pipeline : Spend"
              value={formatRatio(roiMetrics?.pipeline_to_spend_ratio ?? null)}
              subtitle={`${formatCurrency(event.pipeline_generated ?? 0)} pipeline`}
              trend={roiColor((roiMetrics?.pipeline_to_spend_ratio ?? 0) - 1)}
              icon={<Briefcase className="w-5 h-5" data-oid="u.zstst" />}
              data-oid="qyqgc_h"
            />
          </div>

          {/* ROI Input Fields */}
          <Card data-oid="dwyptl0">
            <CardHeader data-oid="31uo30a">
              <div
                className="flex items-center justify-between"
                data-oid="j_aofj1"
              >
                <CardTitle
                  className="flex items-center gap-2"
                  data-oid="l0e7z58"
                >
                  <TrendingUp
                    className="w-5 h-5 text-ink-gold"
                    data-oid="x3vn9yy"
                  />
                  ROI Data
                </CardTitle>
                {!isEditingROI ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditingROI(true)}
                    leftIcon={<Edit className="w-4 h-4" data-oid="4dcouv:" />}
                    data-oid="ro0alod"
                  >
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2" data-oid="-cwt50m">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setIsEditingROI(false);
                        if (event) {
                          setRoiForm({
                            pipeline_generated: event.pipeline_generated ?? 0,
                            revenue_closed: event.revenue_closed ?? 0,
                            leads_generated: event.leads_generated ?? 0,
                            meetings_booked: event.meetings_booked ?? 0,
                            opportunities_created:
                              event.opportunities_created ?? 0,
                            roi_notes: event.roi_notes ?? "",
                          });
                        }
                      }}
                      disabled={isSavingROI}
                      data-oid="bcjeivn"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={handleSaveROI}
                      isLoading={isSavingROI}
                      leftIcon={<Save className="w-4 h-4" data-oid="p8lukk7" />}
                      data-oid="_lntksb"
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent data-oid="aiftgh0">
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                data-oid=":lzcw3y"
              >
                <div data-oid="7-098:l">
                  <label
                    className="block text-sm font-medium text-wood-dark mb-1"
                    data-oid="npy.c:9"
                  >
                    Pipeline Generated
                  </label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={roiForm.pipeline_generated}
                      onChange={(e) =>
                        setRoiForm((f) => ({
                          ...f,
                          pipeline_generated: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                      data-oid="a5qejo0"
                    />
                  ) : (
                    <p
                      className="font-serif text-lg font-semibold text-ink-black"
                      data-oid=":jk.0e6"
                    >
                      {formatCurrency(event.pipeline_generated ?? 0)}
                    </p>
                  )}
                </div>
                <div data-oid="lx7oai6">
                  <label
                    className="block text-sm font-medium text-wood-dark mb-1"
                    data-oid="2k3iio-"
                  >
                    Revenue Closed
                  </label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={roiForm.revenue_closed}
                      onChange={(e) =>
                        setRoiForm((f) => ({
                          ...f,
                          revenue_closed: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                      data-oid="6ks.hyc"
                    />
                  ) : (
                    <p
                      className="font-serif text-lg font-semibold text-ink-black"
                      data-oid="tdtm-ms"
                    >
                      {formatCurrency(event.revenue_closed ?? 0)}
                    </p>
                  )}
                </div>
                <div data-oid="8vrzrpl">
                  <label
                    className="block text-sm font-medium text-wood-dark mb-1"
                    data-oid="phkagcs"
                  >
                    Leads Generated
                  </label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      min="0"
                      value={roiForm.leads_generated}
                      onChange={(e) =>
                        setRoiForm((f) => ({
                          ...f,
                          leads_generated: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                      data-oid="tfac:j9"
                    />
                  ) : (
                    <p
                      className="font-serif text-lg font-semibold text-ink-black"
                      data-oid="9pffm2w"
                    >
                      {event.leads_generated ?? 0}
                    </p>
                  )}
                </div>
                <div data-oid="-jwrpzw">
                  <label
                    className="block text-sm font-medium text-wood-dark mb-1"
                    data-oid="qv:_a9u"
                  >
                    Meetings Booked
                  </label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      min="0"
                      value={roiForm.meetings_booked}
                      onChange={(e) =>
                        setRoiForm((f) => ({
                          ...f,
                          meetings_booked: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                      data-oid="po:s:cr"
                    />
                  ) : (
                    <p
                      className="font-serif text-lg font-semibold text-ink-black"
                      data-oid="osq492o"
                    >
                      {event.meetings_booked ?? 0}
                    </p>
                  )}
                </div>
                <div data-oid="_dmd.ef">
                  <label
                    className="block text-sm font-medium text-wood-dark mb-1"
                    data-oid="0pbxma-"
                  >
                    Opportunities Created
                  </label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      min="0"
                      value={roiForm.opportunities_created}
                      onChange={(e) =>
                        setRoiForm((f) => ({
                          ...f,
                          opportunities_created: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                      data-oid="cp0zzhi"
                    />
                  ) : (
                    <p
                      className="font-serif text-lg font-semibold text-ink-black"
                      data-oid="8adco8n"
                    >
                      {event.opportunities_created ?? 0}
                    </p>
                  )}
                </div>
                <div data-oid="6xhrm-y">
                  <label
                    className="block text-sm font-medium text-wood-dark mb-1"
                    data-oid="4y:umu4"
                  >
                    Actual Spent
                  </label>
                  <p
                    className="font-serif text-lg font-semibold text-sepia"
                    data-oid="f_imbfi"
                  >
                    {formatCurrency(event.actual_spent)}
                  </p>
                  <p
                    className="text-xs text-sepia/70 mt-0.5"
                    data-oid="ro33i3:"
                  >
                    From expenses (read-only)
                  </p>
                </div>
              </div>
              <div className="mt-4" data-oid="aruko3c">
                <label
                  className="block text-sm font-medium text-wood-dark mb-1"
                  data-oid=":da4rks"
                >
                  ROI Notes
                </label>
                {isEditingROI ? (
                  <textarea
                    value={roiForm.roi_notes}
                    onChange={(e) =>
                      setRoiForm((f) => ({ ...f, roi_notes: e.target.value }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                    placeholder="Add context about ROI attribution, pipeline sources, etc."
                    data-oid="uyyjg:b"
                  />
                ) : (
                  <p
                    className="text-sm text-sepia whitespace-pre-wrap"
                    data-oid="w26j-zq"
                  >
                    {event.roi_notes || "No ROI notes yet."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      {activeTab === "details" && (
        <div
          className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          data-oid="knvtjp7"
        >
          {/* Left Column - Budget and Details */}
          <div className="xl:col-span-2 space-y-6" data-oid="lmm8630">
            {/* Budget Overview */}
            <Card data-oid="snubk2v">
              <CardHeader data-oid="9mhh.zo">
                <CardTitle
                  className="flex items-center gap-2"
                  data-oid="kqk1wd-"
                >
                  <DollarSign
                    className="w-5 h-5 text-ink-gold"
                    data-oid="sb62cj9"
                  />
                  Budget Overview
                </CardTitle>
              </CardHeader>
              <CardContent data-oid="kjqf8pj">
                <BudgetProgress
                  label="Event Budget"
                  spent={event.actual_spent}
                  budget={event.budget_amount}
                  data-oid="3xoql8y"
                />
              </CardContent>
            </Card>

            {/* Expenses List */}
            <Card data-oid="o.og8m5">
              <CardHeader data-oid="oyxyyam">
                <div
                  className="flex items-center justify-between"
                  data-oid=".5ah58y"
                >
                  <div data-oid="j_h40qz">
                    <CardTitle
                      className="flex items-center gap-2"
                      data-oid="fti5a1e"
                    >
                      <Receipt
                        className="w-5 h-5 text-ink-gold"
                        data-oid="wnvxwl4"
                      />
                      Expenses
                    </CardTitle>
                    <CardDescription data-oid="iz4no1t">
                      {expenses.length} expense
                      {expenses.length !== 1 ? "s" : ""} recorded
                    </CardDescription>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" data-oid="vtbmmqu" />}
                    onClick={() =>
                      router.push(`/expenses?event_id=${event.id}`)
                    }
                    data-oid="u6zo5.9"
                  >
                    Add Expense
                  </Button>
                </div>
              </CardHeader>
              <CardContent data-oid="qo74a9-">
                {expenses.length === 0 ? (
                  <div className="text-center py-8" data-oid="7ey88up">
                    <Receipt
                      className="w-10 h-10 text-sepia/30 mx-auto mb-3"
                      data-oid="8.qbh64"
                    />
                    <p className="text-sepia" data-oid="av0a4_:">
                      No expenses recorded yet.
                    </p>
                    <p
                      className="text-sm text-sepia/70 mt-1"
                      data-oid="ar8cqve"
                    >
                      Add expenses to track spending against this event's
                      budget.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3" data-oid="lfxuv0x">
                    {expenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
                        data-oid="8ns_66k"
                      >
                        <div className="flex-1 min-w-0" data-oid="vsdp-c:">
                          <div
                            className="flex items-center gap-2"
                            data-oid="dtmtr44"
                          >
                            <span
                              className="font-medium text-ink-black"
                              data-oid="b6g.jt3"
                            >
                              {expense.vendor || "Unknown Vendor"}
                            </span>
                            <span
                              className={`
                              text-xs px-2 py-0.5 rounded
                              ${
                                expense.source_type === "brex"
                                  ? "bg-blue-100 text-blue-700"
                                  : expense.source_type === "pdf"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-gray-100 text-gray-700"
                              }
                            `}
                              data-oid="2q0ctvr"
                            >
                              {expense.source_type}
                            </span>
                          </div>
                          {expense.memo && (
                            <p
                              className="text-sm text-sepia mt-1 truncate"
                              data-oid="hkxme.h"
                            >
                              {expense.memo}
                            </p>
                          )}
                          <p
                            className="text-xs text-sepia/70 mt-1"
                            data-oid="s6y:2dv"
                          >
                            {new Date(expense.expense_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </p>
                        </div>
                        <div className="text-right ml-4" data-oid=":.wjhs-">
                          <span
                            className="font-serif font-semibold text-lg tabular-nums text-ink-black"
                            data-oid="o7q.ypc"
                          >
                            {formatCurrency(expense.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              {expenses.length > 0 && (
                <CardFooter className="justify-between" data-oid="b.b9q5i">
                  <span className="text-sm text-sepia" data-oid="dhz17.v">
                    Total Expenses
                  </span>
                  <span
                    className="font-serif font-bold text-lg tabular-nums text-wood-dark"
                    data-oid="uw1fnuc"
                  >
                    {formatCurrency(event.actual_spent)}
                  </span>
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Right Column - Goals and Notes */}
          <div className="space-y-6" data-oid=":36kxyi">
            {/* Opportunity Goals */}
            {(event.expansion_goal > 0 || event.net_new_goal > 0) && (
              <Card data-oid="u55t_5x">
                <CardHeader data-oid="1v5hqfr">
                  <CardTitle
                    className="flex items-center gap-2"
                    data-oid="99gnf8q"
                  >
                    <Target
                      className="w-5 h-5 text-ink-gold"
                      data-oid="h1twci6"
                    />
                    Opportunity Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4" data-oid="orx7m9.">
                  {event.expansion_goal > 0 && (
                    <div
                      className="flex items-center justify-between p-3 rounded-lg bg-parchment border border-wood-medium/20"
                      data-oid="g71kywl"
                    >
                      <span className="text-sepia" data-oid="uc7mac8">
                        Expansion
                      </span>
                      <span
                        className="font-serif font-semibold text-xl tabular-nums text-ink-black"
                        data-oid="etpbyc."
                      >
                        {event.expansion_goal}
                      </span>
                    </div>
                  )}
                  {event.net_new_goal > 0 && (
                    <div
                      className="flex items-center justify-between p-3 rounded-lg bg-parchment border border-wood-medium/20"
                      data-oid="6u0v49i"
                    >
                      <span className="text-sepia" data-oid="avusurm">
                        Net New
                      </span>
                      <span
                        className="font-serif font-semibold text-xl tabular-nums text-ink-green"
                        data-oid="g6:pild"
                      >
                        {event.net_new_goal}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Planning Notes */}
            {(event.approach_notes ||
              event.marketing_notes ||
              event.sales_notes) && (
              <Card data-oid="ig66:dj">
                <CardHeader data-oid="2gh.lg3">
                  <CardTitle
                    className="flex items-center gap-2"
                    data-oid="icz.id."
                  >
                    <FileText
                      className="w-5 h-5 text-ink-gold"
                      data-oid="2rw9ah4"
                    />
                    Planning Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4" data-oid="zgzinfn">
                  {event.approach_notes && (
                    <div data-oid="kumdph6">
                      <h4
                        className="text-sm font-medium text-wood-dark mb-1"
                        data-oid=".y:.z49"
                      >
                        Approach
                      </h4>
                      <p
                        className="text-sm text-sepia whitespace-pre-wrap"
                        data-oid="4c.-sul"
                      >
                        {event.approach_notes}
                      </p>
                    </div>
                  )}
                  {event.marketing_notes && (
                    <div data-oid="nrpyngy">
                      <h4
                        className="text-sm font-medium text-wood-dark mb-1"
                        data-oid=":0oyjv2"
                      >
                        Marketing
                      </h4>
                      <p
                        className="text-sm text-sepia whitespace-pre-wrap"
                        data-oid="exa2wcl"
                      >
                        {event.marketing_notes}
                      </p>
                    </div>
                  )}
                  {event.sales_notes && (
                    <div data-oid="fd-ghzg">
                      <h4
                        className="text-sm font-medium text-wood-dark mb-1"
                        data-oid="i7ekru2"
                      >
                        Sales
                      </h4>
                      <p
                        className="text-sm text-sepia whitespace-pre-wrap"
                        data-oid="rxh_rj6"
                      >
                        {event.sales_notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card data-oid="4hd8b98">
              <CardHeader data-oid="0qgybsm">
                <CardTitle className="text-sm" data-oid="nktb13y">
                  Event Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm" data-oid="crp6e5f">
                <div className="flex justify-between" data-oid="8rgqk:s">
                  <span className="text-sepia" data-oid="f05qyyu">
                    Event ID
                  </span>
                  <span
                    className="font-mono text-xs text-wood-dark"
                    data-oid="o_yq58p"
                  >
                    {event.id}
                  </span>
                </div>
                <div className="flex justify-between" data-oid="fysbj-t">
                  <span className="text-sepia" data-oid="2edhrb3">
                    Fiscal Year
                  </span>
                  <span className="text-wood-dark" data-oid="m7hh.bo">
                    2026
                  </span>
                </div>
                <div className="flex justify-between" data-oid="2b163pj">
                  <span className="text-sepia" data-oid="kbrdqjk">
                    Created
                  </span>
                  <span className="text-wood-dark" data-oid=":t0m6:k">
                    {new Date(event.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between" data-oid="2rd-uk7">
                  <span className="text-sepia" data-oid="o913ty0">
                    Last Updated
                  </span>
                  <span className="text-wood-dark" data-oid="hm90o7l">
                    {new Date(event.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
