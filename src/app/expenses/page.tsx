"use client";

import { useEffect, useRef, useState } from "react";
import { Receipt, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { ExpenseList } from "@/components/expenses/ExpenseList";
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
   Victorian theme: "The Expense Register"
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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingExpense, setEditingExpense] =
    useState<ExpenseWithRelations | null>(null);

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
      alert(err instanceof Error ? err.message : "Failed to create expense");
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
      alert(err instanceof Error ? err.message : "Failed to update expense");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete expense (optimistic UI)
  const handleDeleteExpense = async (expense: ExpenseWithRelations) => {
    if (
      !confirm(
        `Are you sure you wish to delete this expense from ${expense.vendor || "Unknown Vendor"}?`,
      )
    ) {
      return;
    }

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
      alert(err instanceof Error ? err.message : "Failed to delete expense");
    }
  };

  // Handle bulk delete expenses (optimistic UI)
  const handleBulkDeleteExpenses = async (
    expensesToDelete: ExpenseWithRelations[],
  ) => {
    if (expensesToDelete.length === 0) return;

    const confirmMsg =
      expensesToDelete.length === 1
        ? `Are you sure you wish to delete this expense?`
        : `Are you sure you wish to delete ${expensesToDelete.length} expenses?`;

    if (!confirm(confirmMsg)) {
      return;
    }

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
        alert(
          `Failed to delete ${failedCount} expense(s). Changes have been reverted.`,
        );
      }
    } catch (err) {
      // Rollback on failure
      setExpenses(previousExpenses);
      alert(
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
    <AppShell data-oid="y46.1jg">
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        data-oid="4s-68.."
      >
        <div data-oid="yd26zxz">
          <h1
            className="text-3xl font-serif font-bold text-wood-dark flex items-center gap-3"
            data-oid="csaszdy"
          >
            <Receipt className="w-8 h-8 text-ink-gold" data-oid="9q60mf8" />
            The Expense Register
          </h1>
          <p className="mt-1 text-sepia" data-oid="s200mmv">
            FY 2026 Expenses &middot; {formatCurrency(totalAmount)} total
            &middot; As of {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-3" data-oid="806s4oq">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            data-oid="1g3v.op"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              data-oid="0w7vlrc"
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
            leftIcon={<Plus className="w-4 h-4" data-oid=":e:6wzz" />}
            data-oid="_g5s899"
          >
            Add Expense
          </Button>
        </div>
      </div>

      {/* Create/Edit Expense Form */}
      {(showCreateForm || editingExpense) && (
        <div ref={formRef} className="mb-8" data-oid="dlk:19v">
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
            data-oid=":tm:5fy"
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
        data-oid="ze-fe5i"
      />

      {/* Footer Info */}
      {!isLoading && !error && expenses.length > 0 && (
        <div
          className="text-center py-6 mt-8 border-t border-wood-medium/20"
          data-oid="pj-d2zz"
        >
          <p className="text-xs text-sepia/60" data-oid="a0tditr">
            Click on an event or category name to view its details.
          </p>
        </div>
      )}
    </AppShell>
  );
}
