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
import { sanitizeCurrency } from "@/lib/format";

/* ============================================
   CATEGORY FORM COMPONENT
   ============================================
   Ghostly-themed form for creating and editing
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
    bg-background border border-border
    text-foreground placeholder:text-muted-foreground/50
    focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const labelClasses = "block text-sm font-medium text-foreground mb-1.5";

  const errorClasses = "text-xs text-destructive mt-1";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Create New Category" : "Edit Category Details"}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Category Name */}
          <div>
            <label htmlFor="name" className={labelClasses}>
              Category Name{" "}
              <span className="text-destructive">
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
             
            />

            {errors.name && (
              <p className={errorClasses}>
                {errors.name}
              </p>
            )}
          </div>

          {/* Budget Amount */}
          <div>
            <label
              htmlFor="budget_amount"
              className={labelClasses}
             
            >
              Budget Amount{" "}
              <span className="text-destructive">
                *
              </span>
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
               
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
               
              />
            </div>
            {errors.budget_amount && (
              <p className={errorClasses}>
                {errors.budget_amount}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className={labelClasses}
             
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
             
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
           
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
           
          >
            {mode === "create" ? "Create Category" : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default CategoryForm;
