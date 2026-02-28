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
    <AppShell data-oid="_zvptt4">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        data-oid="f9_xldb"
      >
        <div data-oid="s_r5i5j">
          <h1
            className="text-3xl font-bold text-foreground flex items-center gap-3"
            data-oid="ijfwbw-"
          >
            <Folder className="w-8 h-8 text-spectral" data-oid="k5afxd1" />
            The Category Ledger
          </h1>
          <p className="mt-1 text-muted-foreground" data-oid="2634td4">
            FY 2026 Budget Categories &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3" data-oid="o_4l0u1">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchCategories}
            disabled={isLoading}
            data-oid="8.d4fwk"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              data-oid="zx17975"
            />
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => setShowCreateForm(true)}
            leftIcon={<Plus className="w-4 h-4" data-oid="z.ae_8w" />}
            data-oid="cnoj46c"
          >
            Add Category
          </Button>
        </div>
      </div>

      {/* Create Category Form (Modal-like) */}
      {showCreateForm && (
        <div className="mb-8" data-oid="t._ixho">
          <CategoryForm
            mode="create"
            onSubmit={handleCreateCategory}
            onCancel={() => setShowCreateForm(false)}
            isLoading={isCreating}
            data-oid="4.15:8b"
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
        data-oid="-yumb83"
      />

      {/* Footer Info */}
      {!isLoading && !error && categories.length > 0 && (
        <div
          className="text-center py-6 mt-8 border-t border-border"
          data-oid="w1ejhe0"
        >
          <p className="text-xs text-muted-foreground/60" data-oid="xmx-i.n">
            Click on any category to view full details and manage expenses.
          </p>
        </div>
      )}
    </AppShell>
  );
}
