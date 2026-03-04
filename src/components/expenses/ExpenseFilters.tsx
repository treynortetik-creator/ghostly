"use client";

import { Filter, X, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ExpenseSource, Event, BudgetCategory } from "@/types/database";
import { sourceTypeLabels } from "@/types/database";

/* ============================================
   EXPENSE FILTERS COMPONENT
   ============================================
   Ghostly-themed filter controls for the expenses list.
   Includes filters for event, category, date range, and vendor search.
   ============================================ */

export interface ExpenseFiltersState {
  event_id: string;
  category_id: string;
  date_start: string;
  date_end: string;
  vendor: string;
  source_type: ExpenseSource | "all";
}

export interface ExpenseFiltersProps {
  /** Current filter state */
  filters: ExpenseFiltersState;
  /** Available events for filter dropdown */
  events: Event[];
  /** Available categories for filter dropdown */
  categories: BudgetCategory[];
  /** Called when any filter changes */
  onFiltersChange: (filters: ExpenseFiltersState) => void;
  /** Called when filters are cleared */
  onClearFilters: () => void;
}

const sourceTypes: ExpenseSource[] = ["manual", "brex", "pdf"];

export function ExpenseFilters({
  filters,
  events,
  categories,
  onFiltersChange,
  onClearFilters,
}: ExpenseFiltersProps) {
  const selectClasses = `
    px-3 py-2 rounded-md
    bg-background border border-border
    text-foreground text-sm
    focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
    transition-colors duration-200
    cursor-pointer
    appearance-none
    bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%235c3d2e%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]
    bg-[length:16px]
    bg-[right_8px_center]
    bg-no-repeat
    pr-8
  `;

  const inputClasses = `
    px-3 py-2 rounded-md
    bg-background border border-border
    text-foreground text-sm placeholder:text-muted-foreground/50
    focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
    transition-colors duration-200
  `;

  const handleChange = (field: keyof ExpenseFiltersState, value: string) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  // Count active filters (excluding empty/all values)
  const activeFilterCount = [
    filters.event_id !== "",
    filters.category_id !== "",
    filters.date_start !== "",
    filters.date_end !== "",
    filters.vendor !== "",
    filters.source_type !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="space-y-4">
      {/* Main filter row */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Filter icon and label */}
        <div
          className="flex items-center gap-2 text-muted-foreground shrink-0"
         
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">
            Filters:
          </span>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap gap-3 flex-1">
          {/* Event Filter */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-event"
              className="sr-only"
             
            >
              Filter by Event
            </label>
            <select
              id="filter-event"
              value={filters.event_id}
              onChange={(e) => handleChange("event_id", e.target.value)}
              className={selectClasses}
             
            >
              <option value="">
                All Events
              </option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-category"
              className="sr-only"
             
            >
              Filter by Category
            </label>
            <select
              id="filter-category"
              value={filters.category_id}
              onChange={(e) => handleChange("category_id", e.target.value)}
              className={selectClasses}
             
            >
              <option value="">
                All Categories
              </option>
              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                 
                >
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Type Filter */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="filter-source"
              className="sr-only"
             
            >
              Filter by Source
            </label>
            <select
              id="filter-source"
              value={filters.source_type}
              onChange={(e) => handleChange("source_type", e.target.value)}
              className={selectClasses}
             
            >
              <option value="all">
                All Sources
              </option>
              {sourceTypes.map((type) => (
                <option key={type} value={type}>
                  {sourceTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-muted-foreground hover:text-destructive"
             
            >
              <X className="w-4 h-4 mr-1" />
              Clear
              <span
                className="ml-1 px-1.5 py-0.5 text-xs bg-red-400/10 text-destructive rounded"
               
              >
                {activeFilterCount}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Second row: Date range and vendor search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="filter-date-start"
            className="text-sm text-muted-foreground shrink-0"
           
          >
            From:
          </label>
          <input
            type="date"
            id="filter-date-start"
            value={filters.date_start}
            onChange={(e) => handleChange("date_start", e.target.value)}
            className={inputClasses}
           
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="filter-date-end"
            className="text-sm text-muted-foreground shrink-0"
           
          >
            To:
          </label>
          <input
            type="date"
            id="filter-date-end"
            value={filters.date_end}
            onChange={(e) => handleChange("date_end", e.target.value)}
            className={inputClasses}
           
          />
        </div>

        {/* Vendor search */}
        <div className="relative flex-1 max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
           
          />
          <input
            type="text"
            placeholder="Search vendor..."
            value={filters.vendor}
            onChange={(e) => handleChange("vendor", e.target.value)}
            className={`${inputClasses} pl-10 w-full`}
           
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================
   ACTIVE FILTER PILLS
   ============================================
   Shows active filters as removable pills.
   ============================================ */

export interface ExpenseFilterPillsProps {
  filters: ExpenseFiltersState;
  events: Event[];
  categories: BudgetCategory[];
  onRemoveFilter: (field: keyof ExpenseFiltersState) => void;
}

export function ExpenseFilterPills({
  filters,
  events,
  categories,
  onRemoveFilter,
}: ExpenseFilterPillsProps) {
  const pills: { label: string; field: keyof ExpenseFiltersState }[] = [];

  if (filters.event_id) {
    const event = events.find((e) => e.id === filters.event_id);
    if (event) {
      pills.push({ label: `Event: ${event.name}`, field: "event_id" });
    }
  }

  if (filters.category_id) {
    const category = categories.find((c) => c.id === filters.category_id);
    if (category) {
      pills.push({ label: `Category: ${category.name}`, field: "category_id" });
    }
  }

  if (filters.date_start) {
    pills.push({ label: `From: ${filters.date_start}`, field: "date_start" });
  }

  if (filters.date_end) {
    pills.push({ label: `To: ${filters.date_end}`, field: "date_end" });
  }

  if (filters.vendor) {
    pills.push({ label: `Vendor: "${filters.vendor}"`, field: "vendor" });
  }

  if (filters.source_type !== "all") {
    pills.push({
      label: `Source: ${sourceTypeLabels[filters.source_type]}`,
      field: "source_type",
    });
  }

  if (pills.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => (
        <span
          key={pill.field}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-spectral/10 text-sm text-foreground border border-border"
         
        >
          {pill.label}
          <button
            onClick={() => onRemoveFilter(pill.field)}
            className="ml-0.5 p-0.5 rounded-full hover:bg-spectral/10 transition-colors"
            aria-label={`Remove ${pill.label} filter`}
           
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export default ExpenseFilters;
