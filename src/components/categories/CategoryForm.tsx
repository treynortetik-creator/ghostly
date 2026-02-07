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
import type { BudgetCategory } from "@/types/database";

/* ============================================
   CATEGORY FORM COMPONENT
   ============================================
   Victorian-styled form for creating and editing
   budget categories. Simple form with name,
   budget amount, and description.
   ============================================ */

export interface CategoryFormData {
  name: string;
  budget_amount: string;
  description: string;
  fiscal_year_id: string;
}

export interface CategoryFormProps {
  /** Initial category data for editing */
  category?: BudgetCategory;
  /** Called when form is submitted successfully */
  onSubmit: (data: CategoryFormData) => Promise<void>;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the form is in a loading state */
  isLoading?: boolean;
  /** Form mode */
  mode?: "create" | "edit";
}

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

export function CategoryForm({
  category,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = "create",
}: CategoryFormProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: category?.name || "",
    budget_amount: category?.budget_amount?.toString() || "",
    description: category?.description || "",
    fiscal_year_id: category?.fiscal_year_id || "",
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof CategoryFormData, string>>
  >({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CategoryFormData, string>> = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = "Category name is required";
    }

    if (!formData.budget_amount.trim()) {
      newErrors.budget_amount = "Budget amount is required";
    } else {
      const budget = parseFloat(formData.budget_amount);
      if (isNaN(budget) || budget < 0) {
        newErrors.budget_amount = "Budget must be a positive number";
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

  const handleChange = (field: keyof CategoryFormData, value: string) => {
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

  return (
    <Card data-oid="t9r9fd8">
      <CardHeader data-oid="u51yqys">
        <CardTitle data-oid="tdgft_p">
          {mode === "create" ? "Create New Category" : "Edit Category Details"}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit} data-oid="d5uspoq">
        <CardContent className="space-y-6" data-oid="woamav5">
          {/* Category Name */}
          <div data-oid="3egwnir">
            <label htmlFor="name" className={labelClasses} data-oid="okelwke">
              Category Name{" "}
              <span className="text-ink-red" data-oid="y-k:9:4">
                *
              </span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={inputClasses}
              placeholder="e.g., Exhibit Properties"
              disabled={isLoading}
              data-oid="rtmd_0."
            />

            {errors.name && (
              <p className={errorClasses} data-oid="1-o32uz">
                {errors.name}
              </p>
            )}
          </div>

          {/* Budget Amount */}
          <div data-oid="je29gly">
            <label
              htmlFor="budget_amount"
              className={labelClasses}
              data-oid="6i.r:v0"
            >
              Budget Amount{" "}
              <span className="text-ink-red" data-oid="ibg2wy:">
                *
              </span>
            </label>
            <div className="relative" data-oid="23lxoqx">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia"
                data-oid="csav8lh"
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
                data-oid="p3_7mti"
              />
            </div>
            {errors.budget_amount && (
              <p className={errorClasses} data-oid="72xz.dg">
                {errors.budget_amount}
              </p>
            )}
          </div>

          {/* Description */}
          <div data-oid="bw3ccrw">
            <label
              htmlFor="description"
              className={labelClasses}
              data-oid="pxwshz7"
            >
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className={`${inputClasses} min-h-[100px] resize-y`}
              placeholder="Describe what this budget category covers..."
              disabled={isLoading}
              data-oid="0i5fqes"
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3" data-oid="w7k5kei">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            data-oid="hazozdu"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            data-oid=".5y461a"
          >
            {mode === "create" ? "Create Category" : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default CategoryForm;
