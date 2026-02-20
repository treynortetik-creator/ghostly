"use client";

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
import { Button } from "@/components/ui/Button";
import { ExpenseCard } from "./ExpenseCard";
import {
  ExpenseFilters,
  ExpenseFilterPills,
  type ExpenseFiltersState,
} from "./ExpenseFilters";
import type {
  Event,
  BudgetCategory,
  ExpenseWithRelations,
} from "@/types/database";
import { formatCurrency } from "@/lib/format";

/* ============================================
   EXPENSE LIST COMPONENT
   ============================================
   Victorian-styled list of expenses with filtering,
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
}: ExpenseListProps) {
  const [filters, setFilters] = useState<ExpenseFiltersState>(initialFilters);
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

  // Reset to page 1 when filters or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortField, sortOrder, pageSize]);

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
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
  };

  const handleRemoveFilter = (field: keyof ExpenseFiltersState) => {
    setFilters((prev) => ({
      ...prev,
      [field]: field === "source_type" ? "all" : "",
    }));
  };

  // Handle sort
  const handleSort = (field: SortField) => {
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
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-4 h-4 text-sepia/40" data-oid="jl1tud6" />
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4 text-ink-gold" data-oid="a7totka" />
    ) : (
      <ArrowDown className="w-4 h-4 text-ink-gold" data-oid="hrqfxdt" />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4" data-oid="sowf2w9">
        <div
          className="h-24 bg-wood-medium/10 rounded animate-pulse"
          data-oid="jn5ukp-"
        />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 bg-wood-medium/10 rounded-lg animate-pulse"
            data-oid="omf2-7s"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-ink-red/5 border-ink-red/20" data-oid="r1il0fv">
        <CardContent className="py-12" data-oid="lzcqwr7">
          <div
            className="flex flex-col items-center justify-center text-center"
            data-oid="s8f5ft2"
          >
            <AlertTriangle
              className="w-12 h-12 text-ink-red mb-4"
              data-oid="kj3h9s-"
            />
            <h3
              className="font-serif text-xl font-semibold text-ink-red mb-2"
              data-oid="4aw6zx8"
            >
              Failed to Load Expenses
            </h3>
            <p className="text-sepia" data-oid="zx9f0b5">
              {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-oid="qvpdpzh">
      {/* Filters */}
      {showFilters && (
        <>
          <ExpenseFilters
            filters={filters}
            events={events}
            categories={categories}
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
            data-oid=":mineke"
          />

          {/* Filter pills */}
          <ExpenseFilterPills
            filters={filters}
            events={events}
            categories={categories}
            onRemoveFilter={handleRemoveFilter}
            data-oid="w7_kkql"
          />
        </>
      )}

      {/* Summary stats and sort controls */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 bg-parchment-dark rounded-lg border border-wood-medium/20"
        data-oid=":9lks02"
      >
        <div className="flex flex-wrap items-center gap-4" data-oid="_m5_m_o">
          {/* Select all checkbox */}
          <label
            className="flex items-center gap-2 cursor-pointer"
            data-oid="6r1-rrv"
          >
            <input
              type="checkbox"
              checked={
                paginatedExpenses.length > 0 &&
                selectedIds.size === paginatedExpenses.length
              }
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-wood-medium/40 text-ink-gold focus:ring-ink-gold/50"
              data-oid="c8fvpxt"
            />

            <span className="text-sm text-sepia" data-oid="q.5-4kp">
              Select all
            </span>
          </label>

          {selectedIds.size > 0 && (
            <>
              <span className="text-wood-medium/30" data-oid="qorsw7:">
                |
              </span>
              <span
                className="text-sm text-ink-gold font-medium"
                data-oid="u2670f2"
              >
                {selectedIds.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                leftIcon={<Trash2 className="w-3.5 h-3.5" data-oid="r_nqjk:" />}
                data-oid="v_mar5h"
              >
                Delete Selected
              </Button>
            </>
          )}

          {selectedIds.size === 0 && (
            <>
              <span className="text-wood-medium/30" data-oid="xgetq5f">
                |
              </span>
              <span className="text-sm text-sepia" data-oid="9k82yxs">
                <span
                  className="font-semibold text-wood-dark"
                  data-oid="2zg-3ma"
                >
                  {totals.count}
                </span>{" "}
                expense{totals.count !== 1 ? "s" : ""}
              </span>
              <span className="text-wood-medium/30" data-oid="1be:-_t">
                |
              </span>
              <span className="text-sm text-sepia" data-oid="w5v1ylw">
                Total:{" "}
                <span
                  className="font-semibold tabular-nums text-wood-dark"
                  data-oid="bn2b7yu"
                >
                  {formatCurrency(totals.amount)}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2" data-oid="ajbn9ib">
          <span className="text-sm text-sepia mr-1" data-oid="ukw401e">
            Sort:
          </span>
          <button
            onClick={() => handleSort("date")}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === "date" ? "bg-ink-gold/10 text-ink-gold" : "text-sepia hover:bg-wood-medium/10"}
            `}
            data-oid="yqju6j0"
          >
            Date
            <SortIcon field="date" data-oid="319m7j." />
          </button>
          <button
            onClick={() => handleSort("amount")}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === "amount" ? "bg-ink-gold/10 text-ink-gold" : "text-sepia hover:bg-wood-medium/10"}
            `}
            data-oid="vx14.gm"
          >
            Amount
            <SortIcon field="amount" data-oid="m:8n3e:" />
          </button>
          <button
            onClick={() => handleSort("vendor")}
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded text-sm
              transition-colors duration-200
              ${sortField === "vendor" ? "bg-ink-gold/10 text-ink-gold" : "text-sepia hover:bg-wood-medium/10"}
            `}
            data-oid="2eq3r.p"
          >
            Vendor
            <SortIcon field="vendor" data-oid="8_na-cc" />
          </button>
        </div>
      </div>

      {/* Expenses list */}
      {sortedExpenses.length === 0 ? (
        <Card data-oid="v_uwayv">
          <CardContent className="py-12" data-oid="horzm9b">
            <div
              className="flex flex-col items-center justify-center text-center"
              data-oid="i1tdfcs"
            >
              <Receipt
                className="w-12 h-12 text-sepia/40 mb-4"
                data-oid="uxf:8wf"
              />
              <h3
                className="font-serif text-xl font-semibold text-wood-dark mb-2"
                data-oid="8-z-k3a"
              >
                No Expenses Found
              </h3>
              <p className="text-sepia" data-oid="c0daf.1">
                {Object.values(filters).some((v) => v !== "" && v !== "all")
                  ? "Try adjusting your filters."
                  : "No expenses have been recorded yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-oid="s4_-i.-">
          {paginatedExpenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-start gap-3"
              data-oid="iny1n6z"
            >
              {/* Checkbox */}
              <div className="pt-4" data-oid="35q3cm3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(expense.id)}
                  onChange={() => handleSelectOne(expense.id)}
                  className="w-4 h-4 rounded border-wood-medium/40 text-ink-gold focus:ring-ink-gold/50 cursor-pointer"
                  data-oid="e7cxdnw"
                />
              </div>
              {/* Expense card */}
              <div className="flex-1" data-oid="ygpxllm">
                <ExpenseCard
                  expense={expense}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  data-oid="omem26u"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {sortedExpenses.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-4 py-4 px-4 mt-4 bg-parchment-dark rounded-lg border border-wood-medium/20"
          data-oid="rm.l2dq"
        >
          {/* Page size selector */}
          <div className="flex items-center gap-2" data-oid="iyfmhar">
            <span className="text-sm text-sepia" data-oid="5b0-1ox">
              Show:
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as PageSize);
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-sm rounded border border-wood-medium/30 bg-parchment text-wood-dark focus:ring-ink-gold/50 focus:border-ink-gold"
              data-oid="93qtwi_"
            >
              <option value={25} data-oid="y56oegm">
                25
              </option>
              <option value={50} data-oid="1-c6ehk">
                50
              </option>
              <option value={100} data-oid="2x4fbew">
                100
              </option>
            </select>
            <span className="text-sm text-sepia" data-oid="a8dd.uc">
              per page
            </span>
          </div>

          {/* Page info */}
          <span className="text-sm text-sepia" data-oid="97zox4p">
            Showing{" "}
            <span className="font-semibold text-wood-dark" data-oid="e6.pahl">
              {startItem}-{endItem}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-wood-dark" data-oid="t:6xpuh">
              {sortedExpenses.length}
            </span>
          </span>

          {/* Page navigation */}
          <div className="flex items-center gap-2" data-oid="p9jjalk">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-oid="8q-9467"
            >
              <ChevronLeft className="w-4 h-4" data-oid="7v:a1of" />
              Previous
            </Button>
            <span className="text-sm text-sepia px-2" data-oid="8j98y_z">
              Page{" "}
              <span className="font-semibold text-wood-dark" data-oid="t:54loi">
                {currentPage}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-wood-dark" data-oid="8r2gsx8">
                {totalPages}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              data-oid="lhyn0ps"
            >
              Next
              <ChevronRight className="w-4 h-4" data-oid="24md.za" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseList;
