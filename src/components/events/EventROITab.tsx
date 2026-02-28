"use client";

import { useState, useEffect } from "react";
import {
  Edit,
  Save,
  TrendingUp,
  Users,
  Handshake,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
} from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import type { EventWithTotals } from "@/types/database";

/* ============================================
   EVENT ROI TAB
   ============================================
   Displays computed ROI metrics (4 stat cards)
   and an editable ROI data form with pipeline,
   revenue, leads, meetings, opportunities,
   and notes fields.
   ============================================ */

interface EventROITabProps {
  event: EventWithTotals;
  onEventUpdated: () => void;
}

// Compute ROI metrics from event data
function computeROIMetrics(event: EventWithTotals) {
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
}

function roiColor(value: number | null) {
  if (value === null) return "neutral" as const;
  if (value > 0.05) return "positive" as const;
  if (value < -0.05) return "negative" as const;
  return "neutral" as const;
}

function formatPercent(value: number | null) {
  if (value === null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null) {
  if (value === null) return "N/A";
  return `${value.toFixed(2)}x`;
}

export function EventROITab({ event, onEventUpdated }: EventROITabProps) {
  const [isEditingROI, setIsEditingROI] = useState(false);
  const [isSavingROI, setIsSavingROI] = useState(false);
  const { toasts, removeToast, toast } = useToast();
  const [roiForm, setRoiForm] = useState({
    pipeline_generated: 0,
    revenue_closed: 0,
    leads_generated: 0,
    meetings_booked: 0,
    opportunities_created: 0,
    roi_notes: "",
  });

  // Sync ROI form when event loads/changes
  useEffect(() => {
    setRoiForm({
      pipeline_generated: event.pipeline_generated ?? 0,
      revenue_closed: event.revenue_closed ?? 0,
      leads_generated: event.leads_generated ?? 0,
      meetings_booked: event.meetings_booked ?? 0,
      opportunities_created: event.opportunities_created ?? 0,
      roi_notes: event.roi_notes ?? "",
    });
  }, [event]);

  const handleSaveROI = async () => {
    setIsSavingROI(true);
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roiForm),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update ROI data");
      }
      setIsEditingROI(false);
      onEventUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save ROI data");
    } finally {
      setIsSavingROI(false);
    }
  };

  const roiMetrics = computeROIMetrics(event);

  return (
    <div className="space-y-6" data-oid="fe-8f5d">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
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
                className="w-5 h-5 text-spectral"
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
                    setRoiForm({
                      pipeline_generated: event.pipeline_generated ?? 0,
                      revenue_closed: event.revenue_closed ?? 0,
                      leads_generated: event.leads_generated ?? 0,
                      meetings_booked: event.meetings_booked ?? 0,
                      opportunities_created:
                        event.opportunities_created ?? 0,
                      roi_notes: event.roi_notes ?? "",
                    });
                  }}
                  disabled={isSavingROI}
                  data-oid="bcjeivn"
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
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
                className="block text-sm font-medium text-foreground mb-1"
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
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral"
                  data-oid="a5qejo0"
                />
              ) : (
                <p
                  className="text-lg font-semibold text-foreground"
                  data-oid=":jk.0e6"
                >
                  {formatCurrency(event.pipeline_generated ?? 0)}
                </p>
              )}
            </div>
            <div data-oid="lx7oai6">
              <label
                className="block text-sm font-medium text-foreground mb-1"
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
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral"
                  data-oid="6ks.hyc"
                />
              ) : (
                <p
                  className="text-lg font-semibold text-foreground"
                  data-oid="tdtm-ms"
                >
                  {formatCurrency(event.revenue_closed ?? 0)}
                </p>
              )}
            </div>
            <div data-oid="8vrzrpl">
              <label
                className="block text-sm font-medium text-foreground mb-1"
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
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral"
                  data-oid="tfac:j9"
                />
              ) : (
                <p
                  className="text-lg font-semibold text-foreground"
                  data-oid="9pffm2w"
                >
                  {event.leads_generated ?? 0}
                </p>
              )}
            </div>
            <div data-oid="-jwrpzw">
              <label
                className="block text-sm font-medium text-foreground mb-1"
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
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral"
                  data-oid="po:s:cr"
                />
              ) : (
                <p
                  className="text-lg font-semibold text-foreground"
                  data-oid="osq492o"
                >
                  {event.meetings_booked ?? 0}
                </p>
              )}
            </div>
            <div data-oid="_dmd.ef">
              <label
                className="block text-sm font-medium text-foreground mb-1"
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
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral"
                  data-oid="cp0zzhi"
                />
              ) : (
                <p
                  className="text-lg font-semibold text-foreground"
                  data-oid="8adco8n"
                >
                  {event.opportunities_created ?? 0}
                </p>
              )}
            </div>
            <div data-oid="6xhrm-y">
              <label
                className="block text-sm font-medium text-foreground mb-1"
                data-oid="4y:umu4"
              >
                Actual Spent
              </label>
              <p
                className="text-lg font-semibold text-muted-foreground"
                data-oid="f_imbfi"
              >
                {formatCurrency(event.actual_spent)}
              </p>
              <p
                className="text-xs text-muted-foreground/60 mt-0.5"
                data-oid="ro33i3:"
              >
                From expenses (read-only)
              </p>
            </div>
          </div>
          <div className="mt-4" data-oid="aruko3c">
            <label
              className="block text-sm font-medium text-foreground mb-1"
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
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral"
                placeholder="Add context about ROI attribution, pipeline sources, etc."
                data-oid="uyyjg:b"
              />
            ) : (
              <p
                className="text-sm text-muted-foreground whitespace-pre-wrap"
                data-oid="w26j-zq"
              >
                {event.roi_notes || "No ROI notes yet."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
