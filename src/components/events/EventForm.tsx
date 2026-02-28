"use client";

import { useState, useEffect, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/Card";
import type { Event, QuarterType, EventTypeRecord } from "@/types/database";
import { quarterLabels } from "@/types/database";
import { sanitizeCurrency } from "@/lib/format";

/* ============================================
   EVENT FORM COMPONENT
   ============================================
   Ghostly-themed form for creating and editing events.
   Supports both create and edit modes.
   ============================================ */

export interface EventFormData {
  name: string;
  event_type_id: string;
  quarter: QuarterType;
  fiscal_year_id: string;
  date_start: string;
  date_end: string;
  location: string;
  budget_amount: string;
  expansion_goal: string;
  net_new_goal: string;
  approach_notes: string;
  marketing_notes: string;
  sales_notes: string;
}

export interface EventFormProps {
  /** Initial event data for editing */
  event?: Event;
  /** Called when form is submitted successfully */
  onSubmit: (data: EventFormData) => Promise<void>;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the form is in a loading state */
  isLoading?: boolean;
  /** Form mode */
  mode?: "create" | "edit";
}

const quarters: QuarterType[] = ["Q1", "Q2", "Q3", "Q4", "TBD"];

export function EventForm({
  event,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = "create",
}: EventFormProps) {
  const [eventTypes, setEventTypes] = useState<EventTypeRecord[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  const [formData, setFormData] = useState<EventFormData>({
    name: event?.name || "",
    event_type_id: event?.event_type_id || "",
    quarter: event?.quarter || "TBD",
    fiscal_year_id: event?.fiscal_year_id || "",
    date_start: event?.date_start || "",
    date_end: event?.date_end || "",
    location: event?.location || "",
    budget_amount: event?.budget_amount?.toString() || "",
    expansion_goal: event?.expansion_goal?.toString() || "0",
    net_new_goal: event?.net_new_goal?.toString() || "0",
    approach_notes: event?.approach_notes || "",
    marketing_notes: event?.marketing_notes || "",
    sales_notes: event?.sales_notes || "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof EventFormData, string>>
  >({});

  const fiscalYearId = formData.fiscal_year_id;
  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        // Get fiscal year from form or fetch current settings
        let fyId = fiscalYearId;
        if (!fyId) {
          const settingsRes = await fetch("/api/settings");
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            fyId = settingsData.settings?.fiscal_year_id;
          }
        }

        if (fyId) {
          const res = await fetch(`/api/event-types?fiscal_year_id=${fyId}`);
          if (res.ok) {
            const data = await res.json();
            setEventTypes(data.event_types || []);
          }
        }
      } catch (err) {
        console.error("Failed to load event types:", err);
      } finally {
        setLoadingTypes(false);
      }
    };
    fetchEventTypes();
  }, [fiscalYearId]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EventFormData, string>> = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = "Event name is required";
    }

    if (!formData.budget_amount.trim()) {
      newErrors.budget_amount = "Budget amount is required";
    } else {
      const budget = parseFloat(formData.budget_amount);
      if (isNaN(budget) || budget < 0) {
        newErrors.budget_amount = "Budget must be a positive number";
      }
    }

    // Date validation
    if (formData.date_start && formData.date_end) {
      if (new Date(formData.date_end) < new Date(formData.date_start)) {
        newErrors.date_end = "End date must be after start date";
      }
    }

    // Goal validation
    if (formData.expansion_goal) {
      const goal = parseInt(formData.expansion_goal);
      if (isNaN(goal) || goal < 0) {
        newErrors.expansion_goal = "Goal must be a positive number";
      }
    }

    if (formData.net_new_goal) {
      const goal = parseInt(formData.net_new_goal);
      if (isNaN(goal) || goal < 0) {
        newErrors.net_new_goal = "Goal must be a positive number";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  const handleChange = (field: keyof EventFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const inputClasses = `
    w-full px-4 py-2.5 rounded-md
    bg-background border border-border
    text-foreground placeholder-muted-foreground/50
    focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const labelClasses = "block text-sm font-medium text-foreground mb-1.5";

  const errorClasses = "text-xs text-destructive mt-1";

  return (
    <Card data-oid="_ol-ebz">
      <CardHeader data-oid="r2ic:rk">
        <CardTitle data-oid="kxs9kiz">
          {mode === "create" ? "Register New Event" : "Edit Event Details"}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit} data-oid="ca9_qe.">
        <CardContent className="space-y-6" data-oid="s:39of-">
          {/* Basic Information */}
          <div className="space-y-4" data-oid="71hkroa">
            <h4
              className="text-sm font-semibold text-foreground border-b border-border pb-2"
              data-oid="pdff3fx"
            >
              Basic Information
            </h4>

            {/* Event Name */}
            <div data-oid="fwds4:a">
              <label htmlFor="name" className={labelClasses} data-oid="qpeb_86">
                Event Name{" "}
                <span className="text-destructive" data-oid="4e90wfc">
                  *
                </span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className={inputClasses}
                placeholder="e.g., NIC Spring Conference"
                disabled={isLoading}
                data-oid="bq9mwwq"
              />

              {errors.name && (
                <p className={errorClasses} data-oid="zwelsoj">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Event Type and Quarter */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              data-oid=":uog7et"
            >
              <div data-oid="s1ad_n9">
                <label
                  htmlFor="event_type_id"
                  className={labelClasses}
                  data-oid="z2_5:uf"
                >
                  Event Type{" "}
                  <span className="text-destructive" data-oid="3tsvqj2">
                    *
                  </span>
                </label>
                <select
                  id="event_type_id"
                  value={formData.event_type_id}
                  onChange={(e) =>
                    handleChange("event_type_id", e.target.value)
                  }
                  className={inputClasses}
                  disabled={isLoading || loadingTypes}
                  data-oid="rwss-5f"
                >
                  <option value="" data-oid="wufa0wv">
                    Select event type...
                  </option>
                  {eventTypes.map((type) => (
                    <option key={type.id} value={type.id} data-oid="7ud3nsa">
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div data-oid=".rm3vjd">
                <label
                  htmlFor="quarter"
                  className={labelClasses}
                  data-oid="lpkne56"
                >
                  Quarter{" "}
                  <span className="text-destructive" data-oid="k:25yk2">
                    *
                  </span>
                </label>
                <select
                  id="quarter"
                  value={formData.quarter}
                  onChange={(e) => handleChange("quarter", e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                  data-oid="eik_q97"
                >
                  {quarters.map((q) => (
                    <option key={q} value={q} data-oid="kt:0oqu">
                      {quarterLabels[q]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              data-oid="juj20ml"
            >
              <div data-oid=".-w1ijx">
                <label
                  htmlFor="date_start"
                  className={labelClasses}
                  data-oid="p-iy.7e"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="date_start"
                  value={formData.date_start}
                  onChange={(e) => handleChange("date_start", e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                  data-oid="5lrpepx"
                />
              </div>

              <div data-oid="ao-p1wx">
                <label
                  htmlFor="date_end"
                  className={labelClasses}
                  data-oid=":vm5.i2"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="date_end"
                  value={formData.date_end}
                  onChange={(e) => handleChange("date_end", e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                  data-oid="1v7yd4_"
                />

                {errors.date_end && (
                  <p className={errorClasses} data-oid="9ikwqna">
                    {errors.date_end}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            <div data-oid="9422w_-">
              <label
                htmlFor="location"
                className={labelClasses}
                data-oid=".i_0fnl"
              >
                Location
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                className={inputClasses}
                placeholder="e.g., San Diego, CA"
                disabled={isLoading}
                data-oid="q.k_9:f"
              />
            </div>
          </div>

          {/* Budget Information */}
          <div className="space-y-4" data-oid="zncxj2:">
            <h4
              className="text-sm font-semibold text-foreground border-b border-border pb-2"
              data-oid="hrzbq.4"
            >
              Budget & Goals
            </h4>

            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
              data-oid="rg0k0b5"
            >
              <div data-oid="i:fozar">
                <label
                  htmlFor="budget_amount"
                  className={labelClasses}
                  data-oid="b6an_kz"
                >
                  Budget Amount{" "}
                  <span className="text-destructive" data-oid="-0t2bkw">
                    *
                  </span>
                </label>
                <div className="relative" data-oid="efuruwx">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    data-oid="g15-.c:"
                  >
                    $
                  </span>
                  <input
                    type="text"
                    id="budget_amount"
                    value={formData.budget_amount}
                    onChange={(e) =>
                      handleChange(
                        "budget_amount",
                        sanitizeCurrency(e.target.value),
                      )
                    }
                    className={`${inputClasses} pl-7`}
                    placeholder="0.00"
                    disabled={isLoading}
                    data-oid="kuvm4n3"
                  />
                </div>
                {errors.budget_amount && (
                  <p className={errorClasses} data-oid="jvu:fl8">
                    {errors.budget_amount}
                  </p>
                )}
              </div>

              <div data-oid="c5vgaha">
                <label
                  htmlFor="expansion_goal"
                  className={labelClasses}
                  data-oid="o3xui_t"
                >
                  Expansion Goal
                </label>
                <input
                  type="number"
                  id="expansion_goal"
                  value={formData.expansion_goal}
                  onChange={(e) =>
                    handleChange("expansion_goal", e.target.value)
                  }
                  className={inputClasses}
                  placeholder="0"
                  min="0"
                  disabled={isLoading}
                  data-oid="-s-58l7"
                />

                {errors.expansion_goal && (
                  <p className={errorClasses} data-oid="3p_r0lq">
                    {errors.expansion_goal}
                  </p>
                )}
              </div>

              <div data-oid="i4c89yc">
                <label
                  htmlFor="net_new_goal"
                  className={labelClasses}
                  data-oid="ri:u-7f"
                >
                  Net New Goal
                </label>
                <input
                  type="number"
                  id="net_new_goal"
                  value={formData.net_new_goal}
                  onChange={(e) => handleChange("net_new_goal", e.target.value)}
                  className={inputClasses}
                  placeholder="0"
                  min="0"
                  disabled={isLoading}
                  data-oid="zoolzns"
                />

                {errors.net_new_goal && (
                  <p className={errorClasses} data-oid="6zt9twn">
                    {errors.net_new_goal}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-4" data-oid="f_s7410">
            <h4
              className="text-sm font-semibold text-foreground border-b border-border pb-2"
              data-oid="2ggrpsp"
            >
              Planning Notes
            </h4>

            <div data-oid="45pvy-r">
              <label
                htmlFor="approach_notes"
                className={labelClasses}
                data-oid="vf.uihz"
              >
                Approach Notes
              </label>
              <textarea
                id="approach_notes"
                value={formData.approach_notes}
                onChange={(e) => handleChange("approach_notes", e.target.value)}
                className={`${inputClasses} min-h-[80px] resize-y`}
                placeholder="Strategy and approach for this event..."
                disabled={isLoading}
                data-oid="q4uvi7:"
              />
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              data-oid="r90_i6h"
            >
              <div data-oid="5z63lo3">
                <label
                  htmlFor="marketing_notes"
                  className={labelClasses}
                  data-oid="lixsy37"
                >
                  Marketing Notes
                </label>
                <textarea
                  id="marketing_notes"
                  value={formData.marketing_notes}
                  onChange={(e) =>
                    handleChange("marketing_notes", e.target.value)
                  }
                  className={`${inputClasses} min-h-[80px] resize-y`}
                  placeholder="Booth details, collateral needs..."
                  disabled={isLoading}
                  data-oid="--:9t14"
                />
              </div>

              <div data-oid="mllz2i1">
                <label
                  htmlFor="sales_notes"
                  className={labelClasses}
                  data-oid="tagrqth"
                >
                  Sales Notes
                </label>
                <textarea
                  id="sales_notes"
                  value={formData.sales_notes}
                  onChange={(e) => handleChange("sales_notes", e.target.value)}
                  className={`${inputClasses} min-h-[80px] resize-y`}
                  placeholder="Target accounts, meeting schedules..."
                  disabled={isLoading}
                  data-oid="pbxho98"
                />
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3" data-oid=":0pg89-">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            data-oid="q8qax:1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            data-oid="f0238ur"
          >
            {mode === "create" ? "Create Event" : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default EventForm;
