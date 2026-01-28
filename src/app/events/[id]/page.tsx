'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
} from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, StatCard } from '@/components/ui/Card';
import { ProgressBar, BudgetProgress } from '@/components/ui/ProgressBar';
import { EventForm, EventFormData } from '@/components/events/EventForm';
import type { Expense, FiscalYear, EventWithTotals } from '@/types/database';
import { eventTypeLabels, quarterLabels } from '@/types/database';

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
  executive: 'bg-ink-gold/15 text-ink-gold border-ink-gold/30',
  national: 'bg-ink-green/15 text-ink-green border-ink-green/30',
  state: 'bg-wood-medium/15 text-wood-dark border-wood-medium/30',
  regional: 'bg-sepia/15 text-sepia border-sepia/30',
  customer: 'bg-ink-red/15 text-ink-red border-ink-red/30',
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
  const [activeTab, setActiveTab] = useState<'details' | 'roi'>('details');
  const [isEditingROI, setIsEditingROI] = useState(false);
  const [isSavingROI, setIsSavingROI] = useState(false);
  const [roiForm, setRoiForm] = useState({
    pipeline_generated: 0,
    revenue_closed: 0,
    leads_generated: 0,
    meetings_booked: 0,
    opportunities_created: 0,
    roi_notes: '',
  });

  // Fetch event details
  const fetchEvent = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event not found');
        }
        throw new Error('Failed to fetch event');
      }
      const data: EventDetailApiResponse = await response.json();
      setEvent(data.event);
      setExpenses(data.expenses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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
        roi_notes: event.roi_notes ?? '',
      });
    }
  }, [event]);

  // Handle save ROI data
  const handleSaveROI = async () => {
    setIsSavingROI(true);
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roiForm),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update ROI data');
      }
      const updatedEvent = await response.json();
      setEvent(updatedEvent);
      setIsEditingROI(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save ROI data');
    } finally {
      setIsSavingROI(false);
    }
  };

  // Handle update event
  const handleUpdateEvent = async (formData: EventFormData) => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event');
      }

      const updatedEvent = await response.json();
      setEvent(updatedEvent);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete event
  const handleDeleteEvent = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      router.push('/events');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete event');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateRange = () => {
    if (!event?.date_start) return 'Dates to be determined';
    const start = formatDate(event.date_start);
    const end = event.date_end ? formatDate(event.date_end) : null;
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
    if (value === null) return 'neutral' as const;
    if (value > 0.05) return 'positive' as const;
    if (value < -0.05) return 'negative' as const;
    return 'neutral' as const;
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatRatio = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${value.toFixed(2)}x`;
  };

  // Loading state
  if (isLoading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 bg-wood-medium/10 rounded" />
          <div className="h-64 bg-wood-medium/10 rounded-lg" />
          <div className="h-48 bg-wood-medium/10 rounded-lg" />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <AppShell>
        <Card className="bg-ink-red/5 border-ink-red/20">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-12 h-12 text-ink-red mb-4" />
              <h3 className="font-serif text-xl font-semibold text-ink-red mb-2">
                {error || 'Event Not Found'}
              </h3>
              <p className="text-sepia mb-6">
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
        <div className="mb-6">
          <Link
            href="/events"
            className="inline-flex items-center text-sm text-sepia hover:text-wood-dark transition-colors"
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
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/events"
          className="inline-flex items-center text-sm text-sepia hover:text-wood-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Events
        </Link>
      </div>

      {/* Event Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-serif font-bold text-wood-dark">
              {event.name}
            </h1>
            <span
              className={`
                inline-flex items-center px-3 py-1 rounded text-sm font-medium border
                ${typeColorClasses[event.event_type]}
              `}
            >
              {eventTypeLabels[event.event_type]}
            </span>
            <span className="text-sm font-medium text-sepia bg-parchment-dark px-3 py-1 rounded border border-wood-medium/20">
              {event.quarter}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sepia">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDateRange()}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {event.location}
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
        <Card className="mb-6 bg-ink-red/5 border-ink-red/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-ink-red" />
                <div>
                  <p className="font-medium text-ink-black">
                    Are you sure you want to delete this event?
                  </p>
                  <p className="text-sm text-sepia">
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
      <div className="flex gap-1 mb-6 border-b border-wood-medium/20">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'details'
              ? 'border-ink-gold text-ink-gold'
              : 'border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40'
          }`}
        >
          <DollarSign className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Budget &amp; Details
        </button>
        <button
          onClick={() => setActiveTab('roi')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roi'
              ? 'border-ink-gold text-ink-gold'
              : 'border-transparent text-sepia hover:text-wood-dark hover:border-wood-medium/40'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          ROI Tracking
        </button>
      </div>

      {/* ROI Tab */}
      {activeTab === 'roi' && (
        <div className="space-y-6">
          {/* Computed ROI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="ROI Ratio"
              value={formatPercent(roiMetrics?.roi_ratio ?? null)}
              subtitle={roiMetrics?.roi_ratio !== null ? (roiMetrics!.roi_ratio > 0 ? 'Positive return' : roiMetrics!.roi_ratio < 0 ? 'Negative return' : 'Break-even') : 'No spend data'}
              trend={roiColor(roiMetrics?.roi_ratio ?? null)}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              title="Cost per Lead"
              value={roiMetrics?.cost_per_lead !== null ? formatCurrency(roiMetrics!.cost_per_lead) : 'N/A'}
              subtitle={`${event.leads_generated ?? 0} leads captured`}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              title="Cost per Meeting"
              value={roiMetrics?.cost_per_meeting !== null ? formatCurrency(roiMetrics!.cost_per_meeting) : 'N/A'}
              subtitle={`${event.meetings_booked ?? 0} meetings booked`}
              icon={<Handshake className="w-5 h-5" />}
            />
            <StatCard
              title="Pipeline : Spend"
              value={formatRatio(roiMetrics?.pipeline_to_spend_ratio ?? null)}
              subtitle={`${formatCurrency(event.pipeline_generated ?? 0)} pipeline`}
              trend={roiColor((roiMetrics?.pipeline_to_spend_ratio ?? 0) - 1)}
              icon={<Briefcase className="w-5 h-5" />}
            />
          </div>

          {/* ROI Input Fields */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-ink-gold" />
                  ROI Data
                </CardTitle>
                {!isEditingROI ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditingROI(true)}
                    leftIcon={<Edit className="w-4 h-4" />}
                  >
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
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
                            opportunities_created: event.opportunities_created ?? 0,
                            roi_notes: event.roi_notes ?? '',
                          });
                        }
                      }}
                      disabled={isSavingROI}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={handleSaveROI}
                      isLoading={isSavingROI}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-wood-dark mb-1">Pipeline Generated</label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={roiForm.pipeline_generated}
                      onChange={(e) => setRoiForm(f => ({ ...f, pipeline_generated: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                    />
                  ) : (
                    <p className="font-serif text-lg font-semibold text-ink-black">{formatCurrency(event.pipeline_generated ?? 0)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-wood-dark mb-1">Revenue Closed</label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={roiForm.revenue_closed}
                      onChange={(e) => setRoiForm(f => ({ ...f, revenue_closed: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                    />
                  ) : (
                    <p className="font-serif text-lg font-semibold text-ink-black">{formatCurrency(event.revenue_closed ?? 0)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-wood-dark mb-1">Leads Generated</label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      min="0"
                      value={roiForm.leads_generated}
                      onChange={(e) => setRoiForm(f => ({ ...f, leads_generated: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                    />
                  ) : (
                    <p className="font-serif text-lg font-semibold text-ink-black">{event.leads_generated ?? 0}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-wood-dark mb-1">Meetings Booked</label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      min="0"
                      value={roiForm.meetings_booked}
                      onChange={(e) => setRoiForm(f => ({ ...f, meetings_booked: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                    />
                  ) : (
                    <p className="font-serif text-lg font-semibold text-ink-black">{event.meetings_booked ?? 0}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-wood-dark mb-1">Opportunities Created</label>
                  {isEditingROI ? (
                    <input
                      type="number"
                      min="0"
                      value={roiForm.opportunities_created}
                      onChange={(e) => setRoiForm(f => ({ ...f, opportunities_created: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                    />
                  ) : (
                    <p className="font-serif text-lg font-semibold text-ink-black">{event.opportunities_created ?? 0}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-wood-dark mb-1">Actual Spent</label>
                  <p className="font-serif text-lg font-semibold text-sepia">{formatCurrency(event.actual_spent)}</p>
                  <p className="text-xs text-sepia/70 mt-0.5">From expenses (read-only)</p>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-wood-dark mb-1">ROI Notes</label>
                {isEditingROI ? (
                  <textarea
                    value={roiForm.roi_notes}
                    onChange={(e) => setRoiForm(f => ({ ...f, roi_notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-parchment border border-wood-medium/50 rounded-lg text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold"
                    placeholder="Add context about ROI attribution, pipeline sources, etc."
                  />
                ) : (
                  <p className="text-sm text-sepia whitespace-pre-wrap">
                    {event.roi_notes || 'No ROI notes yet.'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      {activeTab === 'details' && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Budget and Details */}
        <div className="xl:col-span-2 space-y-6">
          {/* Budget Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-ink-gold" />
                Budget Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetProgress
                label="Event Budget"
                spent={event.actual_spent}
                budget={event.budget_amount}
              />
            </CardContent>
          </Card>

          {/* Expenses List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-ink-gold" />
                    Expenses
                  </CardTitle>
                  <CardDescription>
                    {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => router.push(`/expenses?event_id=${event.id}`)}
                >
                  Add Expense
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-10 h-10 text-sepia/30 mx-auto mb-3" />
                  <p className="text-sepia">No expenses recorded yet.</p>
                  <p className="text-sm text-sepia/70 mt-1">
                    Add expenses to track spending against this event's budget.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-black">
                            {expense.vendor || 'Unknown Vendor'}
                          </span>
                          <span
                            className={`
                              text-xs px-2 py-0.5 rounded
                              ${expense.source_type === 'brex' ? 'bg-blue-100 text-blue-700' :
                                expense.source_type === 'pdf' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'}
                            `}
                          >
                            {expense.source_type}
                          </span>
                        </div>
                        {expense.memo && (
                          <p className="text-sm text-sepia mt-1 truncate">
                            {expense.memo}
                          </p>
                        )}
                        <p className="text-xs text-sepia/70 mt-1">
                          {new Date(expense.expense_date).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <span className="font-serif font-semibold text-lg tabular-nums text-ink-black">
                          {formatCurrency(expense.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {expenses.length > 0 && (
              <CardFooter className="justify-between">
                <span className="text-sm text-sepia">Total Expenses</span>
                <span className="font-serif font-bold text-lg tabular-nums text-wood-dark">
                  {formatCurrency(event.actual_spent)}
                </span>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Right Column - Goals and Notes */}
        <div className="space-y-6">
          {/* Opportunity Goals */}
          {(event.expansion_goal > 0 || event.net_new_goal > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-ink-gold" />
                  Opportunity Goals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.expansion_goal > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-parchment border border-wood-medium/20">
                    <span className="text-sepia">Expansion</span>
                    <span className="font-serif font-semibold text-xl tabular-nums text-ink-black">
                      {event.expansion_goal}
                    </span>
                  </div>
                )}
                {event.net_new_goal > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-parchment border border-wood-medium/20">
                    <span className="text-sepia">Net New</span>
                    <span className="font-serif font-semibold text-xl tabular-nums text-ink-green">
                      {event.net_new_goal}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Planning Notes */}
          {(event.approach_notes || event.marketing_notes || event.sales_notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-ink-gold" />
                  Planning Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.approach_notes && (
                  <div>
                    <h4 className="text-sm font-medium text-wood-dark mb-1">
                      Approach
                    </h4>
                    <p className="text-sm text-sepia whitespace-pre-wrap">
                      {event.approach_notes}
                    </p>
                  </div>
                )}
                {event.marketing_notes && (
                  <div>
                    <h4 className="text-sm font-medium text-wood-dark mb-1">
                      Marketing
                    </h4>
                    <p className="text-sm text-sepia whitespace-pre-wrap">
                      {event.marketing_notes}
                    </p>
                  </div>
                )}
                {event.sales_notes && (
                  <div>
                    <h4 className="text-sm font-medium text-wood-dark mb-1">
                      Sales
                    </h4>
                    <p className="text-sm text-sepia whitespace-pre-wrap">
                      {event.sales_notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-sepia">Event ID</span>
                <span className="font-mono text-xs text-wood-dark">{event.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sepia">Fiscal Year</span>
                <span className="text-wood-dark">2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sepia">Created</span>
                <span className="text-wood-dark">
                  {new Date(event.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sepia">Last Updated</span>
                <span className="text-wood-dark">
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
