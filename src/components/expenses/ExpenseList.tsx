"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useMemo, useEffect } from "react";
import {
  Receipt,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ExpenseCard } from "./ExpenseCard";
import {
  ExpenseFilters,
  ExpenseFilterPills,
  type ExpenseFiltersState,
} from "./ExpenseFilters";
import { SavedFilters } from "@/components/filters/SavedFilters";
import type {
  Event,
  BudgetCategory,
  ExpenseWithRelations,
} from "@/types/database";
import { formatCurrency } from "@/lib/format";

/* ============================================
   EXPENSE LIST COMPONENT
   ============================================
   Ghostly-themed list of expenses with filtering,
   search, sorting, pagination, and bulk actions.
   ============================================ */

export type SortField = "date" | "amount" | "vendor";
export type SortOrder = "asc" | "desc";
export type PageSize = 25 | 50 | 100;

export interface ExpenseListProps {
  /** List of expenses to display */
  expenses: ExpenseWithRelations[];
  /** Available events for filtering */
  events: Event[];
  /** Available categories for filtering */
  categories: BudgetCategory[];
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Show filters */
  showFilters?: boolean;
  /** Callback when edit is clicked */
  onEdit?: (expense: ExpenseWithRelations) => void;
  /** Callback when delete is clicked */
  onDelete?: (expense: ExpenseWithRelations) => void;
  /** Callback for bulk delete */
  onBulkDelete?: (expenses: ExpenseWithRelations[]) => void;
  /** Initial filter values (from URL params) */
  initialFilters?: Partial<ExpenseFiltersState>;
  /** Called when filter state changes, for URL sync */
  onFiltersSync?: (filters: ExpenseFiltersState) => void;
}

const initialFilters: ExpenseFiltersState = {
  event_id: "",
  category_id: "",
  date_start: "",
  date_end: "",
  vendor: "",
  source_type: "all",
};

export function ExpenseList({
  expenses,
  events,
  categories,
  isLoading = false,
  error = null,
  showFilters = true,
  onEdit,
  onDelete,
  onBulkDelete,
  initialFilters: initialFiltersProp,
  onFiltersSync,
}: ExpenseListProps) {
  const [filters, setFilters] = useState<ExpenseFiltersState>({
    ...initialFilters,
    ...initialFiltersProp,
  });
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    let filtered = expenses;

    // Apply event filter
    if (filters.event_id) {
      filtered = filtered.filter((e) => e.event_id === filters.event_id);
    }

    // Apply category filter
    if (filters.category_id) {
      filtered = filtered.filter((e) => e.category_id === filters.category_id);
    }

    // Apply date range filter
    if (filters.date_start) {
      filtered = filtered.filter((e) => e.expense_date >= filters.date_start);
    }
    if (filters.date_end) {
      filtered = filtered.filter((e) => e.expense_date <= filters.date_end);
    }

    // Apply vendor search
    if (filters.vendor.trim()) {
      const query = filters.vendor.toLowerCase();
      filtered = filtered.filter(
        (e) => e.vendor?.toLowerCase().includes(query) || false,
      );
    }

    // Apply source type filter
    if (filters.source_type !== "all") {
      filtered = filtered.filter((e) => e.source_type === filters.source_type);
    }

    return filtered;
  }, [expenses, filters]);

  // Sort expenses
  const sortedExpenses = useMemo(() => {
    const sorted = [...filteredExpenses];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "amount":
          comparison = a.amount - b.amount;
          break;
        case "vendor":
          comparison = (a.vendor || "").localeCompare(b.vendor || "");
          break;
        case "date":
        default:
          comparison = a.expense_date.localeCompare(b.expense_date);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [filteredExpenses, sortField, sortOrder]);

  // Paginated expenses
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedExpenses.slice(startIndex, startIndex + pageSize);
  }, [sortedExpenses, currentPage, pageSize]);

  // Pagination info
  const totalPages = Math.ceil(sortedExpenses.length / pageSize);
  const startItem =
    sortedExpenses.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, sortedExpenses.length);

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === paginatedExpenses.length) {
      // Deselect all on current page
      setSelectedIds(new Set());
    } else {
      // Select all on current page
      setSelectedIds(new Set(paginatedExpenses.map((e) => e.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    const selectedExpenses = expenses.filter((e) => selectedIds.has(e.id));
    if (onBulkDelete) {
      onBulkDelete(selectedExpenses);
    }
    setSelectedIds(new Set());
  };

  // Clear selection when expenses change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [expenses]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: ExpenseFiltersState) => {
    setCurrentPage(1);
    setFilters(newFilters);
    onFiltersSync?.(newFilters);
  };

  const handleClearFilters = () => {
    setCurrentPage(1);
    setFilters(initialFilters);
    onFiltersSync?.(initialFilters);
  };

  const handleRemoveFilter = (field: keyof ExpenseFiltersState) => {
    setCurrentPage(1);
    const updated = {
      ...filters,
      [field]: field === "source_type" ? "all" : "",
    };
    setFilters(updated);
    onFiltersSync?.(updated);
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      // Toggle order
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    return sortedExpenses.reduce(
      (acc, expense) => ({
        amount: acc.amount + expense.amount,
        count: acc.count + 1,
      }),
      { amount: 0, count: 0 },
    );
  }, [sortedExpenses]);

  // Sort indicator
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-4 h-4 text-muted-foreground/60" />
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 text-spectral" />
    ) : (
      <ArrowDown className="w-4 h-4 text-spectral" />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div
          className="h-24 bg-spectral/10 rounded animate-pulse"
         
        />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 bg-spectral/10 rounded-lg animate-pulse"
           
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-red-400/10 border-destructive/20">
        <CardContent className="py-12">
          <div
            className="flex flex-col items-center justify-center text-center"
           
          >
            <AlertTriangle
              className="w-12 h-12 text-destructive mb-4"
             
            />
            <h3
              className="text-xl font-semibold text-destructive mb-2"
             
            >
              Failed to Load Expenses
            </h3>
            <p className="text-muted-foreground">
              {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <>
          <ExpenseFilters
            filters={filters}
            events={events}
            categories={categories}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
           
          />

          {/* Filter pills + saved presets */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <ExpenseFilterPills
              filters={filters}
              events={events}
              categories={categories}
              onRemoveFilter={handleRemoveFilter}
            />
            <SavedFilters
              page="expenses"
              currentParams={filters as unknown as Record<string, string>}
              onApply={(params) => {
                const restored: ExpenseFiltersState = {
                  event_id: params.event_id || "",
                  category_id: params.category_id || "",
                  date_start: params.date_start || "",
                  date_end: params.date_end || "",
                  vendor: params.vendor || "",
                  source_type: (params.source_type as ExpenseFiltersState["source_type"]) || "all",
                };
                handleFiltersChange(restored);
              }}
            />
          </div>
        </>
      )}

      {/* Summary stats and sort controls */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 bg-card rounded-lg border border-border"
       
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Select all checkbox */}
          <label
            className="flex items-center gap-2 cursor-pointer"
           
          >
            <input
              type="checkbox"
              checked={
                paginatedExpenses.length > 0 &&
                selectedIds.size === paginatedExpenses.length
              }
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-border text-spectral focus:ring-spectral/50"
             
            />

            <span className="text-sm text-muted-foreground">
              Select all
            </span>
          </label>

          {selectedIds.size > 0 && (
            <>
              <span className="text-muted-foreground/30">
                |
              </span>
              <span
                className="text-sm text-spectral font-medium"
               
              >
                {selectedIds.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
               
              >
                Delete Selected
              </Button>
            </>
          )}

          {selectedIds.size === 0 && (
            <>
              <span className="text-muted-foreground/30">
                |
              </span>
              <span className="text-sm text-muted-foreground">
                <span
                  className="font-semibold text-foreground"
                 
                >
                  {totals.count}
                </span>{" "}
                expense{totals.count !== 1 ? "s" : ""}
              </span>
              <span className="text-muted-foreground/30">
                |
              </span>
              <span className="text-sm text-muted-foreground">
                Total:{" "}
                <span
                  className="font-semibold tabular-nums text-foreground"
                 
                >
                  {formatCurrency(totals.amount)}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">
            Sort:
          </span>
          <button
            onClick={() => handleSort("date")}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === "date" ? "bg-spectral/10 text-spectral" : "text-muted-foreground hover:bg-spectral/10"}
            `}
           
          >
            Date
            {renderSortIcon("date")}
          </button>
          <button
            onClick={() => handleSort("amount")}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === "amount" ? "bg-spectral/10 text-spectral" : "text-muted-foreground hover:bg-spectral/10"}
            `}
           
          >
            Amount
            {renderSortIcon("amount")}
          </button>
          <button
            onClick={() => handleSort("vendor")}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === "vendor" ? "bg-spectral/10 text-spectral" : "text-muted-foreground hover:bg-spectral/10"}
            `}
           
          >
            Vendor
            {renderSortIcon("vendor")}
          </button>
        </div>
      </div>

      {/* Expenses list */}
      {sortedExpenses.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Receipt className="w-12 h-12" />}
              title="No Expenses Found"
              description={
                Object.values(filters).some((v) => v !== "" && v !== "all")
                  ? "Try adjusting your filters."
                  : "No expenses have been recorded yet."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedExpenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-start gap-3"
             
            >
              {/* Checkbox */}
              <div className="pt-4">
                <input
                  type="checkbox"
                  checked={selectedIds.has(expense.id)}
                  onChange={() => handleSelectOne(expense.id)}
                  className="w-4 h-4 rounded border-border text-spectral focus:ring-spectral/50 cursor-pointer"
                 
                />
              </div>
              {/* Expense card */}
              <div className="flex-1">
                <ExpenseCard
                  expense={expense}
                  onEdit={onEdit}
                  onDelete={onDelete}
                 
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {sortedExpenses.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-4 py-4 px-4 mt-4 bg-card rounded-lg border border-border"
         
        >
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Show:
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSize);
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-sm rounded border border-border bg-background text-foreground focus:ring-spectral/50 focus:border-spectral"
             
            >
              <option value={25}>
                25
              </option>
              <option value={50}>
                50
              </option>
              <option value={100}>
                100
              </option>
            </select>
            <span className="text-sm text-muted-foreground">
              per page
            </span>
          </div>

          {/* Page info */}
          <span className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {startItem}-{endItem}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {sortedExpenses.length}
            </span>
          </span>

          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
             
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page{" "}
              <span className="font-semibold text-foreground">
                {currentPage}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">
                {totalPages}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
             
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseList;
