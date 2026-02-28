"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Receipt, Plus, RefreshCw, Upload, Download } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import type { ExpenseFiltersState } from "@/components/expenses/ExpenseFilters";
import {
  ExpenseForm,
  ExpenseFormData,
} from "@/components/expenses/ExpenseForm";
import { formatCurrency } from "@/lib/format";
import type {
  Event,
  BudgetCategory,
  ExpenseWithRelations,
} from "@/types/database";

/* ============================================
   EXPENSES LIST PAGE
   ============================================
   Main expenses management page showing all expenses
   with filtering, search, sorting, and add functionality.
   Ghostly theme: "The Expense Register"
   ============================================ */

interface ExpensesApiResponse {
  expenses: ExpenseWithRelations[];
  meta: {
    total: number;
    total_amount: number;
    filters_applied: Record<string, string>;
    sort: { by: string; order: string };
  };
}

interface EventsApiResponse {
  events: Event[];
  meta: { total: number };
}

interface CategoriesApiResponse {
  categories: BudgetCategory[];
  meta: { total: number };
}

function ExpensesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial filter values from URL search params
  const initialFiltersFromUrl: Partial<ExpenseFiltersState> = {
    ...(searchParams.get("event_id") ? { event_id: searchParams.get("event_id")! } : {}),
    ...(searchParams.get("category_id") ? { category_id: searchParams.get("category_id")! } : {}),
    ...(searchParams.get("date_start") ? { date_start: searchParams.get("date_start")! } : {}),
    ...(searchParams.get("date_end") ? { date_end: searchParams.get("date_end")! } : {}),
    ...(searchParams.get("vendor") ? { vendor: searchParams.get("vendor")! } : {}),
    ...(searchParams.get("source_type") ? { source_type: searchParams.get("source_type") as ExpenseFiltersState["source_type"] } : {}),
  };

  // Sync filter changes to URL search params
  const handleFiltersSync = useCallback(
    (filters: ExpenseFiltersState) => {
      const params = new URLSearchParams();
      if (filters.event_id) params.set("event_id", filters.event_id);
      if (filters.category_id) params.set("category_id", filters.category_id);
      if (filters.date_start) params.set("date_start", filters.date_start);
      if (filters.date_end) params.set("date_end", filters.date_end);
      if (filters.vendor) params.set("vendor", filters.vendor);
      if (filters.source_type !== "all") params.set("source_type", filters.source_type);

      const queryString = params.toString();
      router.replace(queryString ? `/expenses?${queryString}` : "/expenses", { scroll: false });
    },
    [router],
  );

  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<ExpenseWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseWithRelations | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<ExpenseWithRelations[]>([]);
  const { toasts, removeToast, toast } = useToast();

  // Ref for the form section so we can scroll to it
  const formRef = useRef<HTMLDivElement>(null);

  // Fetch expenses and related data
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [expensesRes, eventsRes, categoriesRes] = await Promise.all([
        fetch("/api/expenses"),
        fetch("/api/events"),
        fetch("/api/categories"),
      ]);

      if (!expensesRes.ok) throw new Error("Failed to fetch expenses");
      if (!eventsRes.ok) throw new Error("Failed to fetch events");
      if (!categoriesRes.ok) throw new Error("Failed to fetch categories");

      const expensesData: ExpensesApiResponse = await expensesRes.json();
      const eventsData: EventsApiResponse = await eventsRes.json();
      const categoriesData: CategoriesApiResponse = await categoriesRes.json();

      setExpenses(expensesData.expenses);
      setEvents(eventsData.events);
      setCategories(categoriesData.categories);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle create expense
  const handleCreateExpense = async (formData: ExpenseFormData) => {
    setIsCreating(true);

    try {
      const payload = {
        amount: parseFloat(formData.amount),
        expense_date: formData.expense_date,
        vendor: formData.vendor || null,
        memo: formData.memo || null,
        source_type: formData.source_type,
        event_id: formData.target_type === "event" ? formData.event_id : null,
        category_id:
          formData.target_type === "category" ? formData.category_id : null,
      };

      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create expense");
      }

      const newExpense: ExpenseWithRelations = await response.json();

      // Add to local state
      setExpenses((prev) => [newExpense, ...prev]);
      setShowCreateForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create expense");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle edit expense — scroll to form so user sees it
  const handleEditExpense = (expense: ExpenseWithRelations) => {
    setEditingExpense(expense);
    setShowCreateForm(false);
    // Scroll to the form after React re-renders
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  // Handle update expense
  const handleUpdateExpense = async (formData: ExpenseFormData) => {
    if (!editingExpense) return;

    setIsCreating(true);

    try {
      const payload = {
        amount: parseFloat(formData.amount),
        expense_date: formData.expense_date,
        vendor: formData.vendor || null,
        memo: formData.memo || null,
        source_type: formData.source_type,
        event_id: formData.target_type === "event" ? formData.event_id : null,
        category_id:
          formData.target_type === "category" ? formData.category_id : null,
      };

      const response = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update expense");
      }

      const data = await response.json();
      const updatedExpense: ExpenseWithRelations = data.expense;

      // Update in local state
      setExpenses((prev) =>
        prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e)),
      );
      setEditingExpense(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update expense");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete expense (optimistic UI)
  const handleDeleteExpense = (expense: ExpenseWithRelations) => {
    setDeleteTarget(expense);
  };

  const confirmDeleteExpense = async () => {
    if (!deleteTarget) return;
    const expense = deleteTarget;
    setDeleteTarget(null);

    // Optimistic: save previous state and remove immediately
    const previousExpenses = expenses;
    setExpenses((prev) => prev.filter((e) => e.id !== expense.id));

    try {
      const response = await fetch(`/api/expenses/${expense.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete expense");
      }
    } catch (err) {
      // Rollback on failure
      setExpenses(previousExpenses);
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    }
  };

  // Handle bulk delete expenses (optimistic UI)
  const handleBulkDeleteExpenses = (
    expensesToDelete: ExpenseWithRelations[],
  ) => {
    if (expensesToDelete.length === 0) return;
    setBulkDeleteTargets(expensesToDelete);
  };

  const confirmBulkDeleteExpenses = async () => {
    const expensesToDelete = bulkDeleteTargets;
    setBulkDeleteTargets([]);
    if (expensesToDelete.length === 0) return;

    // Optimistic: save previous state and remove immediately
    const previousExpenses = expenses;
    const deleteIds = new Set(expensesToDelete.map((e) => e.id));
    setExpenses((prev) => prev.filter((e) => !deleteIds.has(e.id)));

    try {
      // Delete all selected expenses
      const deletePromises = expensesToDelete.map((expense) =>
        fetch(`/api/expenses/${expense.id}`, { method: "DELETE" }),
      );

      const results = await Promise.all(deletePromises);
      const failedCount = results.filter((r) => !r.ok).length;

      if (failedCount > 0) {
        // Rollback: restore previous state since some failed
        setExpenses(previousExpenses);
        toast.error(
          `Failed to delete ${failedCount} expense(s). Changes have been reverted.`,
        );
      }
    } catch (err) {
      // Rollback on failure
      setExpenses(previousExpenses);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to delete expenses. Changes have been reverted.",
      );
    }
  };

  // Format date for header
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Calculate total amount
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <AppShell>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Expense"
        message={`Are you sure you wish to delete this expense from ${deleteTarget?.vendor || "Unknown Vendor"}?`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDeleteExpense}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={bulkDeleteTargets.length > 0}
        title="Delete Expenses"
        message={
          bulkDeleteTargets.length === 1
            ? "Are you sure you wish to delete this expense?"
            : `Are you sure you wish to delete ${bulkDeleteTargets.length} expenses?`
        }
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmBulkDeleteExpenses}
        onCancel={() => setBulkDeleteTargets([])}
      />
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
       
      >
        <div>
          <h1
            className="text-3xl font-bold text-foreground flex items-center gap-3"
           
          >
            <Receipt className="w-8 h-8 text-spectral" />
            The Expense Register
          </h1>
          <p className="mt-1 text-muted-foreground">
            FY 2026 Expenses &middot; {formatCurrency(totalAmount)} total
            &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/import")}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/export")}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              setEditingExpense(null);
              setShowCreateForm(true);
              setTimeout(() => {
                formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 0);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Expense
          </Button>
        </div>
      </div>

      {/* Create/Edit Expense Form */}
      {(showCreateForm || editingExpense) && (
        <div ref={formRef} className="mb-8">
          <ExpenseForm
            key={editingExpense?.id ?? "create"}
            mode={editingExpense ? "edit" : "create"}
            expense={editingExpense || undefined}
            events={events}
            categories={categories}
            onSubmit={
              editingExpense ? handleUpdateExpense : handleCreateExpense
            }
            onCancel={() => {
              setShowCreateForm(false);
              setEditingExpense(null);
            }}
            isLoading={isCreating}
           
          />
        </div>
      )}

      {/* Expenses List */}
      <ExpenseList
        expenses={expenses}
        events={events}
        categories={categories}
        isLoading={isLoading}
        error={error}
        showFilters={true}
        onEdit={handleEditExpense}
        onDelete={handleDeleteExpense}
        onBulkDelete={handleBulkDeleteExpenses}
        initialFilters={initialFiltersFromUrl}
        onFiltersSync={handleFiltersSync}
      />

      {/* Footer Info */}
      {!isLoading && !error && expenses.length > 0 && (
        <div
          className="text-center py-6 mt-8 border-t border-border"
         
        >
          <p className="text-xs text-muted-foreground/60">
            Click on an event or category name to view its details.
          </p>
        </div>
      )}
    </AppShell>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesPageContent />
    </Suspense>
  );
}
