"use client";

import { useState, useMemo, useEffect } from "react";
import { Calendar, AlertTriangle, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventCard } from "./EventCard";
import { EventFilters, FilterPills } from "./EventFilters";
import { formatCurrency } from "@/lib/format";
import type {
  QuarterType,
  Expense,
  EventWithTotals,
  EventTypeRecord,
} from "@/types/database";

/* ============================================
   EVENT LIST COMPONENT
   ============================================
   Ghostly-themed list of events with filtering,
   search, and grouped display options.
   ============================================ */

export interface EventListProps {
  /** List of events to display */
  events: EventWithTotals[];
  /** Map of event IDs to their expenses (for expandable rows) */
  expensesByEvent?: Record<string, Expense[]>;
  /** Whether to show expandable expense rows */
  expandable?: boolean;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Called when filters change */
  onFiltersChange?: (filters: {
    typeId: string | "all";
    quarter: QuarterType | "all";
    search: string;
  }) => void;
  /** Show search input */
  showSearch?: boolean;
  /** Group events by quarter */
  groupByQuarter?: boolean;
  /** Initial filter values (from URL params) */
  initialTypeId?: string | "all";
  /** Initial quarter filter (from URL params) */
  initialQuarter?: QuarterType | "all";
  /** Initial search query (from URL params) */
  initialSearch?: string;
}

export function EventList({
  events,
  expensesByEvent = {},
  expandable = false,
  isLoading = false,
  error = null,
  onFiltersChange,
  showSearch = true,
  groupByQuarter = false,
  initialTypeId = "all",
  initialQuarter = "all",
  initialSearch = "",
}: EventListProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string | "all">(initialTypeId);
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterType | "all">(
    initialQuarter,
  );
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [eventTypes, setEventTypes] = useState<EventTypeRecord[]>([]);

  // Fetch event types for display in pills
  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const settingsRes = await fetch("/api/settings");
        let fyId: string | undefined;
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          fyId = settingsData.settings?.fiscal_year_id;
        }

        if (fyId) {
          const res = await fetch(`/api/event-types?fiscal_year_id=${fyId}`);
          if (res.ok) {
            const data = await res.json();
            setEventTypes(data.event_types || []);
          }
        }
      } catch (err) {
        console.error("Failed to load event types:", err);
      }
    };
    fetchEventTypes();
  }, []);

  // Get the selected event type name for display in pills
  const selectedTypeName =
    selectedTypeId !== "all"
      ? eventTypes.find((t) => t.id === selectedTypeId)?.name || null
      : null;

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Apply type filter by event_type_id
    if (selectedTypeId !== "all") {
      filtered = filtered.filter((e) => e.event_type_id === selectedTypeId);
    }

    // Apply quarter filter
    if (selectedQuarter !== "all") {
      filtered = filtered.filter((e) => e.quarter === selectedQuarter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.location?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [events, selectedTypeId, selectedQuarter, searchQuery]);

  // Group events by quarter if needed
  const groupedEvents = useMemo(() => {
    if (!groupByQuarter) return null;

    const groups: Record<QuarterType, EventWithTotals[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
      TBD: [],
    };

    filteredEvents.forEach((event) => {
      groups[event.quarter].push(event);
    });

    return groups;
  }, [filteredEvents, groupByQuarter]);

  // Count active filters
  const activeFilterCount = [
    selectedTypeId !== "all",
    selectedQuarter !== "all",
  ].filter(Boolean).length;

  // Handle filter changes
  const handleTypeChange = (typeId: string | "all") => {
    setSelectedTypeId(typeId);
    onFiltersChange?.({ typeId, quarter: selectedQuarter, search: searchQuery });
  };

  const handleQuarterChange = (quarter: QuarterType | "all") => {
    setSelectedQuarter(quarter);
    onFiltersChange?.({ typeId: selectedTypeId, quarter, search: searchQuery });
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onFiltersChange?.({ typeId: selectedTypeId, quarter: selectedQuarter, search: value });
  };

  const handleClearFilters = () => {
    setSelectedTypeId("all");
    setSelectedQuarter("all");
    setSearchQuery("");
    onFiltersChange?.({ typeId: "all", quarter: "all", search: "" });
  };

  // Calculate totals
  const totals = useMemo(() => {
    return filteredEvents.reduce(
      (acc, event) => ({
        budget: acc.budget + event.budget_amount,
        actual: acc.actual + event.actual_spent,
        count: acc.count + 1,
      }),
      { budget: 0, actual: 0, count: 0 },
    );
  }, [filteredEvents]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div
          className="h-12 bg-spectral/10 rounded animate-pulse"
         
        />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 bg-spectral/10 rounded-lg animate-pulse"
           
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
              Failed to Load Events
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
      {/* Filters and Search */}
      <div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
       
      >
        <EventFilters
          selectedTypeId={selectedTypeId}
          selectedQuarter={selectedQuarter}
          onTypeChange={handleTypeChange}
          onQuarterChange={handleQuarterChange}
          onClearFilters={handleClearFilters}
          activeFilterCount={activeFilterCount}
         
        />

        {showSearch && (
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
             
            />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="
                pl-10 pr-4 py-2 rounded-md w-full lg:w-64
                bg-background border border-border
                text-foreground placeholder-muted-foreground/50
                focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
                transition-colors duration-200
              "
             
            />
          </div>
        )}
      </div>

      {/* Active filter pills */}
      <FilterPills
        selectedTypeId={selectedTypeId}
        selectedTypeName={selectedTypeName}
        selectedQuarter={selectedQuarter}
        onRemoveType={() => handleTypeChange("all")}
        onRemoveQuarter={() => handleQuarterChange("all")}
       
      />

      {/* Summary stats */}
      <div
        className="flex flex-wrap items-center gap-4 py-3 px-4 bg-card rounded-lg border border-border"
       
      >
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {totals.count}
          </span>{" "}
          events
        </span>
        <span className="text-muted-foreground/30">
          |
        </span>
        <span className="text-sm text-muted-foreground">
          Budget:{" "}
          <span
            className="font-semibold tabular-nums text-foreground"
           
          >
            {formatCurrency(totals.budget)}
          </span>
        </span>
        <span className="text-muted-foreground/30">
          |
        </span>
        <span className="text-sm text-muted-foreground">
          Spent:{" "}
          <span
            className="font-semibold tabular-nums text-foreground"
           
          >
            {formatCurrency(totals.actual)}
          </span>
        </span>
        <span className="text-muted-foreground/30">
          |
        </span>
        <span className="text-sm text-muted-foreground">
          Remaining:{" "}
          <span
            className={`font-semibold tabular-nums ${
              totals.budget - totals.actual < 0
                ? "text-destructive"
                : "text-emerald-400"
            }`}
           
          >
            {formatCurrency(totals.budget - totals.actual)}
          </span>
        </span>
      </div>

      {/* Events list */}
      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Calendar className="w-12 h-12" />}
              title="No Events Found"
              description={
                searchQuery || activeFilterCount > 0
                  ? "Try adjusting your filters or search query."
                  : "No events have been registered yet."
              }
            />
          </CardContent>
        </Card>
      ) : groupByQuarter && groupedEvents ? (
        // Grouped by quarter
        <div className="space-y-6">
          {(["Q1", "Q2", "Q3", "Q4", "TBD"] as QuarterType[]).map((quarter) => {
            const quarterEvents = groupedEvents[quarter];
            if (quarterEvents.length === 0) return null;

            const quarterTotal = quarterEvents.reduce(
              (sum, e) => sum + e.budget_amount,
              0,
            );
            const quarterSpent = quarterEvents.reduce(
              (sum, e) => sum + e.actual_spent,
              0,
            );

            return (
              <div key={quarter}>
                <div
                  className="flex items-center justify-between mb-3"
                 
                >
                  <h3
                    className="text-lg font-semibold text-foreground"
                   
                  >
                    {quarter === "TBD" ? "To Be Determined" : quarter}
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    <span className="tabular-nums">
                      {formatCurrency(quarterSpent)}
                    </span>
                    <span className="mx-1">
                      /
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(quarterTotal)}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {quarterEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      expenses={expensesByEvent[event.id]}
                      expandable={expandable}
                     
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Flat list
        <div className="space-y-3">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              expenses={expensesByEvent[event.id]}
              expandable={expandable}
             
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default EventList;
