"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/Card";
import type { EventTypeRecord } from "@/types/database";
import { sanitizeCurrency } from "@/lib/format";

/* ============================================
   EVENT TYPE FORM COMPONENT
   ============================================
   Form for creating and editing event types.
   Used in the Settings > Event Types section.
   Ghostly theme: "The Category Ledger"
   ============================================ */

export interface EventTypeFormData {
  name: string;
  budget_amount: string;
  description: string;
}

export interface EventTypeFormProps {
  /** Existing event type for edit mode */
  eventType?: EventTypeRecord;
  /** Submit handler - receives form data */
  onSubmit: (data: EventTypeFormData) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
  /** Loading state for submit button */
  isLoading?: boolean;
  /** Form mode - create or edit */
  mode?: "create" | "edit";
}

export function EventTypeForm({
  eventType,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = "create",
}: EventTypeFormProps) {
  const [formData, setFormData] = useState<EventTypeFormData>({
    name: eventType?.name || "",
    budget_amount: eventType?.budget_amount?.toString() || "0",
    description: eventType?.description || "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof EventTypeFormData, string>>
  >({});

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EventTypeFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    const budget = parseFloat(formData.budget_amount);
    if (isNaN(budget) || budget < 0) {
      newErrors.budget_amount = "Budget must be zero or positive";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(formData);
  };

  /**
   * Handle field change with error clearing
   */
  const handleChange = (field: keyof EventTypeFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Shared input styles matching the Ghostly theme
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
    <Card data-oid="q1unkgz">
      <CardHeader data-oid="lhyv2ns">
        <CardTitle data-oid="psd-9e_">
          {mode === "create" ? "Add Event Type" : "Edit Event Type"}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit} data-oid="3wl5nz3">
        <CardContent className="space-y-4" data-oid="tb80uws">
          {/* Name Field */}
          <div data-oid="i5bd0qh">
            <label htmlFor="name" className={labelClasses} data-oid="fnw_2dg">
              Name{" "}
              <span className="text-destructive" data-oid="h6h6se.">
                *
              </span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={inputClasses}
              placeholder="e.g., Executive"
              disabled={isLoading}
              data-oid="9w9r1ux"
            />

            {errors.name && (
              <p className={errorClasses} data-oid="a-gu3ih">
                {errors.name}
              </p>
            )}
          </div>

          {/* Budget Amount Field */}
          <div data-oid="yk7cxyi">
            <label
              htmlFor="budget_amount"
              className={labelClasses}
              data-oid="7q8qt:n"
            >
              Budget Amount
            </label>
            <div className="relative" data-oid="3:_1hwj">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                data-oid="ypssh1q"
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
                data-oid="omt_end"
              />
            </div>
            {errors.budget_amount && (
              <p className={errorClasses} data-oid="64m7act">
                {errors.budget_amount}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div data-oid="68.gy64">
            <label
              htmlFor="description"
              className={labelClasses}
              data-oid="ooavb0r"
            >
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className={`${inputClasses} min-h-[80px] resize-y`}
              placeholder="Brief description of this event type..."
              disabled={isLoading}
              data-oid="tzx0vhq"
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3" data-oid="4f0tbus">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            data-oid="3rz_sbm"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            data-oid="obc6t-6"
          >
            {mode === "create" ? "Add Type" : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default EventTypeForm;
