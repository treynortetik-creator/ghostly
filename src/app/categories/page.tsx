"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Folder, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { CategoryList } from "@/components/categories/CategoryList";
import {
  CategoryForm,
  CategoryFormData,
} from "@/components/categories/CategoryForm";
import type { CategoryWithTotals } from "@/types/database";

/* ============================================
   CATEGORIES LIST PAGE
   ============================================
   Main budget categories management page showing
   all non-event budget buckets with budget progress.
   Ghostly theme: "The Category Ledger"
   ============================================ */

interface CategoriesApiResponse {
  categories: CategoryWithTotals[];
  meta: {
    total: number;
    filters_applied: Record<string, string>;
  };
}

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryWithTotals[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toasts, removeToast, toast } = useToast();

  // Fetch categories
  const fetchCategories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/categories");
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      const data: CategoriesApiResponse = await response.json();
      setCategories(data.categories);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Handle create category
  const handleCreateCategory = async (formData: CategoryFormData) => {
    setIsCreating(true);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create category");
      }

      const newCategory = await response.json();

      // Add to local state (in real app, would refetch)
      setCategories((prev) => [newCategory, ...prev]);
      setShowCreateForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsCreating(false);
    }
  };

  // Format date for header
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
       
      >
        <div>
          <h1
            className="text-3xl font-bold text-foreground flex items-center gap-3"
           
          >
            <Folder className="w-8 h-8 text-spectral" />
            The Category Ledger
          </h1>
          <p className="mt-1 text-muted-foreground">
            FY {new Date().getFullYear()} Budget Categories &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchCategories}
            disabled={isLoading}
           
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
             
            />
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
            leftIcon={<Plus className="w-4 h-4" />}
           
          >
            Add Category
          </Button>
        </div>
      </div>

      {/* Create Category Form (Modal-like) */}
      {showCreateForm && (
        <div className="mb-8">
          <CategoryForm
            mode="create"
            onSubmit={handleCreateCategory}
            onCancel={() => setShowCreateForm(false)}
            isLoading={isCreating}
           
          />
        </div>
      )}

      {/* Categories List */}
      <CategoryList
        categories={categories}
        isLoading={isLoading}
        error={error}
        expandable={false}
        showSearch={true}
       
      />

      {/* Footer Info */}
      {!isLoading && !error && categories.length > 0 && (
        <div
          className="text-center py-6 mt-8 border-t border-border"
         
        >
          <p className="text-xs text-muted-foreground/60">
            Click on any category to view full details and manage expenses.
          </p>
        </div>
      )}
    </AppShell>
  );
}
