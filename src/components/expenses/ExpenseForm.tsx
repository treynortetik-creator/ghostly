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
import type {
  Expense,
  ExpenseSource,
  Event,
  BudgetCategory,
} from "@/types/database";
import { sourceTypeLabels } from "@/types/database";

/* ============================================
   EXPENSE FORM COMPONENT
   ============================================
   Victorian-styled form for creating and editing expenses.
   Enforces XOR constraint: exactly one of event OR category.
   ============================================ */

export interface ExpenseFormData {
  amount: string;
  expense_date: string;
  vendor: string;
  memo: string;
  source_type: ExpenseSource;
  target_type: "event" | "category";
  event_id: string;
  category_id: string;
}

export interface ExpenseFormProps {
  /** Initial expense data for editing */
  expense?: Expense;
  /** List of available events */
  events: Event[];
  /** List of available categories */
  categories: BudgetCategory[];
  /** Called when form is submitted successfully */
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the form is in a loading state */
  isLoading?: boolean;
  /** Form mode */
  mode?: "create" | "edit";
  /** Pre-select event ID (for adding expense from event detail) */
  preselectedEventId?: string;
  /** Pre-select category ID (for adding expense from category detail) */
  preselectedCategoryId?: string;
}

const sourceTypes: ExpenseSource[] = ["manual", "brex", "pdf"];

// Helper to sanitize currency input - only allows one decimal point
const sanitizeCurrency = (value: string): string => {
  // Remove all non-numeric except decimal points
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    // Keep only first decimal point
    return parts[0] + "." + parts.slice(1).join("");
  }
  return cleaned;
};

export function ExpenseForm({
  expense,
  events,
  categories,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = "create",
  preselectedEventId,
  preselectedCategoryId,
}: ExpenseFormProps) {
  // Determine initial target type
  const getInitialTargetType = (): "event" | "category" => {
    if (expense?.event_id) return "event";
    if (expense?.category_id) return "category";
    if (preselectedEventId) return "event";
    if (preselectedCategoryId) return "category";
    return "event"; // default
  };

  const [formData, setFormData] = useState<ExpenseFormData>({
    amount: expense?.amount?.toString() || "",
    expense_date:
      expense?.expense_date || new Date().toISOString().split("T")[0],
    vendor: expense?.vendor || "",
    memo: expense?.memo || "",
    source_type: expense?.source_type || "manual",
    target_type: getInitialTargetType(),
    event_id: expense?.event_id || preselectedEventId || "",
    category_id: expense?.category_id || preselectedCategoryId || "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof ExpenseFormData, string>>
  >({});

  // Handle target type change - clear the non-selected target
  const handleTargetTypeChange = (newTargetType: "event" | "category") => {
    setFormData((prev) => ({
      ...prev,
      target_type: newTargetType,
      // Clear the non-selected target
      event_id: newTargetType === "event" ? prev.event_id : "",
      category_id: newTargetType === "category" ? prev.category_id : "",
    }));
    // Clear any target-related errors
    setErrors((prev) => ({
      ...prev,
      event_id: undefined,
      category_id: undefined,
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ExpenseFormData, string>> = {};

    // Required amount
    if (!formData.amount.trim()) {
      newErrors.amount = "Amount is required";
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = "Amount must be a positive number";
      }
    }

    // Required expense_date
    if (!formData.expense_date) {
      newErrors.expense_date = "Date is required";
    }

    // XOR constraint validation
    if (formData.target_type === "event") {
      if (!formData.event_id) {
        newErrors.event_id = "Please select an event";
      }
    } else {
      if (!formData.category_id) {
        newErrors.category_id = "Please select a category";
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

  const handleChange = (field: keyof ExpenseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const inputClasses = `
    w-full px-4 py-2.5 rounded-md
    bg-parchment border border-wood-medium/40
    text-ink-black placeholder-sepia/50
    focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const labelClasses = "block text-sm font-medium text-wood-dark mb-1.5";

  const errorClasses = "text-xs text-ink-red mt-1";

  const radioLabelClasses = `
    flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer
    transition-all duration-200
  `;

  return (
    <Card data-oid="ymh7ypu">
      <CardHeader data-oid="gxu:4_4">
        <CardTitle data-oid="ndk2ocf">
          {mode === "create" ? "Record New Expense" : "Edit Expense Record"}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit} data-oid="8j_xv9t">
        <CardContent className="space-y-6" data-oid=":76wdms">
          {/* Expense Details */}
          <div className="space-y-4" data-oid="jzf:a-l">
            <h4
              className="text-sm font-semibold text-wood-dark border-b border-wood-medium/20 pb-2"
              data-oid="1lj3bl7"
            >
              Expense Details
            </h4>

            {/* Amount and Date */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              data-oid="x0fxjz."
            >
              <div data-oid="xoj4qx0">
                <label
                  htmlFor="amount"
                  className={labelClasses}
                  data-oid="9j1dukx"
                >
                  Amount{" "}
                  <span className="text-ink-red" data-oid="cf3:s:1">
                    *
                  </span>
                </label>
                <div className="relative" data-oid="j8ep4lk">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia"
                    data-oid="f4pbn0b"
                  >
                    $
                  </span>
                  <input
                    type="text"
                    id="amount"
                    value={formData.amount}
                    onChange={(e) =>
                      handleChange("amount", sanitizeCurrency(e.target.value))
                    }
                    className={`${inputClasses} pl-7`}
                    placeholder="0.00"
                    disabled={isLoading}
                    data-oid="-j7wz8c"
                  />
                </div>
                {errors.amount && (
                  <p className={errorClasses} data-oid="f4lm9_9">
                    {errors.amount}
                  </p>
                )}
              </div>

              <div data-oid="a-6nvq1">
                <label
                  htmlFor="expense_date"
                  className={labelClasses}
                  data-oid="tpu7nc4"
                >
                  Date{" "}
                  <span className="text-ink-red" data-oid="duuever">
                    *
                  </span>
                </label>
                <input
                  type="date"
                  id="expense_date"
                  value={formData.expense_date}
                  onChange={(e) => handleChange("expense_date", e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                  data-oid="bexkq_j"
                />

                {errors.expense_date && (
                  <p className={errorClasses} data-oid="b4zk96l">
                    {errors.expense_date}
                  </p>
                )}
              </div>
            </div>

            {/* Vendor */}
            <div data-oid="d2iyvaf">
              <label
                htmlFor="vendor"
                className={labelClasses}
                data-oid="b065rgy"
              >
                Vendor
              </label>
              <input
                type="text"
                id="vendor"
                value={formData.vendor}
                onChange={(e) => handleChange("vendor", e.target.value)}
                className={inputClasses}
                placeholder="e.g., Marriott Hotels"
                disabled={isLoading}
                data-oid="aj.ierf"
              />
            </div>

            {/* Source Type */}
            <div data-oid="wwb0xgz">
              <label
                htmlFor="source_type"
                className={labelClasses}
                data-oid="w99p-ti"
              >
                Source Type
              </label>
              <select
                id="source_type"
                value={formData.source_type}
                onChange={(e) => handleChange("source_type", e.target.value)}
                className={inputClasses}
                disabled={isLoading}
                data-oid="15m3yw3"
              >
                {sourceTypes.map((type) => (
                  <option key={type} value={type} data-oid="khyrpvz">
                    {sourceTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Memo */}
            <div data-oid="pkidisp">
              <label htmlFor="memo" className={labelClasses} data-oid="y37t1y6">
                Memo / Description
              </label>
              <textarea
                id="memo"
                value={formData.memo}
                onChange={(e) => handleChange("memo", e.target.value)}
                className={`${inputClasses} min-h-[80px] resize-y`}
                placeholder="Notes about this expense..."
                disabled={isLoading}
                data-oid="aw02x5:"
              />
            </div>
          </div>

          {/* Target Selection - XOR Constraint */}
          <div className="space-y-4" data-oid="xdoolqo">
            <h4
              className="text-sm font-semibold text-wood-dark border-b border-wood-medium/20 pb-2"
              data-oid="bls.xdl"
            >
              Assign To{" "}
              <span className="text-ink-red" data-oid="nb93mcz">
                *
              </span>
              <span className="font-normal text-sepia ml-2" data-oid="nufuk25">
                (select one)
              </span>
            </h4>

            {/* Radio buttons for target type */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              data-oid="tk79495"
            >
              {/* Event Option */}
              <label
                className={`
                  ${radioLabelClasses}
                  ${
                    formData.target_type === "event"
                      ? "border-ink-gold bg-ink-gold/5"
                      : "border-wood-medium/30 hover:border-wood-medium/50 bg-parchment/50"
                  }
                `}
                data-oid="5eb8ps:"
              >
                <input
                  type="radio"
                  name="target_type"
                  value="event"
                  checked={formData.target_type === "event"}
                  onChange={() => handleTargetTypeChange("event")}
                  className="w-4 h-4 text-ink-gold focus:ring-ink-gold/50"
                  disabled={isLoading}
                  data-oid="ij1mvof"
                />

                <div data-oid="1.kke1g">
                  <span
                    className="font-medium text-wood-dark"
                    data-oid="nld290v"
                  >
                    Event
                  </span>
                  <p className="text-xs text-sepia" data-oid="cb_qxs.">
                    Assign to a specific conference or meeting
                  </p>
                </div>
              </label>

              {/* Category Option */}
              <label
                className={`
                  ${radioLabelClasses}
                  ${
                    formData.target_type === "category"
                      ? "border-ink-gold bg-ink-gold/5"
                      : "border-wood-medium/30 hover:border-wood-medium/50 bg-parchment/50"
                  }
                `}
                data-oid="0n9rs-o"
              >
                <input
                  type="radio"
                  name="target_type"
                  value="category"
                  checked={formData.target_type === "category"}
                  onChange={() => handleTargetTypeChange("category")}
                  className="w-4 h-4 text-ink-gold focus:ring-ink-gold/50"
                  disabled={isLoading}
                  data-oid="oqfd.:-"
                />

                <div data-oid="dciaxxo">
                  <span
                    className="font-medium text-wood-dark"
                    data-oid="9sr-g3d"
                  >
                    Category
                  </span>
                  <p className="text-xs text-sepia" data-oid="0kxul8j">
                    Assign to a budget category
                  </p>
                </div>
              </label>
            </div>

            {/* Event Selector (shown when event is selected) */}
            {formData.target_type === "event" && (
              <div className="mt-4" data-oid="muqbyh6">
                <label
                  htmlFor="event_id"
                  className={labelClasses}
                  data-oid="hqu5-8z"
                >
                  Select Event{" "}
                  <span className="text-ink-red" data-oid="80qy4qs">
                    *
                  </span>
                </label>
                <select
                  id="event_id"
                  value={formData.event_id}
                  onChange={(e) => handleChange("event_id", e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                  data-oid="-ssk9jl"
                >
                  <option value="" data-oid="w4o7gqi">
                    -- Select an event --
                  </option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id} data-oid="jal92ff">
                      {event.name} ({event.quarter})
                    </option>
                  ))}
                </select>
                {errors.event_id && (
                  <p className={errorClasses} data-oid="nsxeiyc">
                    {errors.event_id}
                  </p>
                )}
              </div>
            )}

            {/* Category Selector (shown when category is selected) */}
            {formData.target_type === "category" && (
              <div className="mt-4" data-oid="dfyb1-5">
                <label
                  htmlFor="category_id"
                  className={labelClasses}
                  data-oid="d-n68_0"
                >
                  Select Category{" "}
                  <span className="text-ink-red" data-oid="3i5.:_e">
                    *
                  </span>
                </label>
                <select
                  id="category_id"
                  value={formData.category_id}
                  onChange={(e) => handleChange("category_id", e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                  data-oid="2jm:769"
                >
                  <option value="" data-oid="2gdrdlt">
                    -- Select a category --
                  </option>
                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                      data-oid="-:oszrt"
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.category_id && (
                  <p className={errorClasses} data-oid="cnjt7ao">
                    {errors.category_id}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3" data-oid="tskx8.p">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            data-oid="tus9g67"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            data-oid="whc880b"
          >
            {mode === "create" ? "Record Expense" : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default ExpenseForm;
