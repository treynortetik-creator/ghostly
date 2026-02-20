"use client";

import { useState, useMemo, useEffect } from "react";
import { Calendar, AlertTriangle, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
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
   Victorian-styled list of events with filtering,
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
  }) => void;
  /** Show search input */
  showSearch?: boolean;
  /** Group events by quarter */
  groupByQuarter?: boolean;
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
}: EventListProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string | "all">("all");
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterType | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
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
    onFiltersChange?.({ typeId, quarter: selectedQuarter });
  };

  const handleQuarterChange = (quarter: QuarterType | "all") => {
    setSelectedQuarter(quarter);
    onFiltersChange?.({ typeId: selectedTypeId, quarter });
  };

  const handleClearFilters = () => {
    setSelectedTypeId("all");
    setSelectedQuarter("all");
    setSearchQuery("");
    onFiltersChange?.({ typeId: "all", quarter: "all" });
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
      <div className="space-y-4" data-oid="c4vl7k1">
        <div
          className="h-12 bg-wood-medium/10 rounded animate-pulse"
          data-oid="f21x_be"
        />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 bg-wood-medium/10 rounded-lg animate-pulse"
            data-oid="p3nle8e"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-ink-red/5 border-ink-red/20" data-oid="nz46xca">
        <CardContent className="py-12" data-oid="wr4.6bw">
          <div
            className="flex flex-col items-center justify-center text-center"
            data-oid="x..mit2"
          >
            <AlertTriangle
              className="w-12 h-12 text-ink-red mb-4"
              data-oid="kh2xw.q"
            />
            <h3
              className="font-serif text-xl font-semibold text-ink-red mb-2"
              data-oid="err9::2"
            >
              Failed to Load Events
            </h3>
            <p className="text-sepia" data-oid="hr_n547">
              {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-oid="s05vcts">
      {/* Filters and Search */}
      <div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        data-oid="6u81cxe"
      >
        <EventFilters
          selectedTypeId={selectedTypeId}
          selectedQuarter={selectedQuarter}
          onTypeChange={handleTypeChange}
          onQuarterChange={handleQuarterChange}
          onClearFilters={handleClearFilters}
          activeFilterCount={activeFilterCount}
          data-oid="h18p5f1"
        />

        {showSearch && (
          <div className="relative" data-oid="s397ru-">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sepia"
              data-oid="py0uo0n"
            />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                pl-10 pr-4 py-2 rounded-md w-full lg:w-64
                bg-parchment border border-wood-medium/40
                text-ink-black placeholder-sepia/50
                focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold
                transition-colors duration-200
              "
              data-oid="k6de68r"
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
        data-oid="04d_:l9"
      />

      {/* Summary stats */}
      <div
        className="flex flex-wrap items-center gap-4 py-3 px-4 bg-parchment-dark rounded-lg border border-wood-medium/20"
        data-oid="g6t2llt"
      >
        <span className="text-sm text-sepia" data-oid="embdgzy">
          <span className="font-semibold text-wood-dark" data-oid="0hl1hvr">
            {totals.count}
          </span>{" "}
          events
        </span>
        <span className="text-wood-medium/30" data-oid="3um0i2f">
          |
        </span>
        <span className="text-sm text-sepia" data-oid="nbq1ehy">
          Budget:{" "}
          <span
            className="font-semibold tabular-nums text-wood-dark"
            data-oid="vwm_xss"
          >
            {formatCurrency(totals.budget)}
          </span>
        </span>
        <span className="text-wood-medium/30" data-oid="bxu9hcs">
          |
        </span>
        <span className="text-sm text-sepia" data-oid="y_96eoc">
          Spent:{" "}
          <span
            className="font-semibold tabular-nums text-wood-dark"
            data-oid="oh-0jeh"
          >
            {formatCurrency(totals.actual)}
          </span>
        </span>
        <span className="text-wood-medium/30" data-oid="usf_tfl">
          |
        </span>
        <span className="text-sm text-sepia" data-oid=":wo3i.j">
          Remaining:{" "}
          <span
            className={`font-semibold tabular-nums ${
              totals.budget - totals.actual < 0
                ? "text-ink-red"
                : "text-ink-green"
            }`}
            data-oid="bfmla.d"
          >
            {formatCurrency(totals.budget - totals.actual)}
          </span>
        </span>
      </div>

      {/* Events list */}
      {filteredEvents.length === 0 ? (
        <Card data-oid="bvrkc.l">
          <CardContent className="py-12" data-oid="qqdw1mu">
            <div
              className="flex flex-col items-center justify-center text-center"
              data-oid="hhl-fcg"
            >
              <Calendar
                className="w-12 h-12 text-sepia/40 mb-4"
                data-oid="lh610j0"
              />
              <h3
                className="font-serif text-xl font-semibold text-wood-dark mb-2"
                data-oid="0jgf8t8"
              >
                No Events Found
              </h3>
              <p className="text-sepia" data-oid="9.bb6w7">
                {searchQuery || activeFilterCount > 0
                  ? "Try adjusting your filters or search query."
                  : "No events have been registered yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : groupByQuarter && groupedEvents ? (
        // Grouped by quarter
        <div className="space-y-6" data-oid="uh2.bo3">
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
              <div key={quarter} data-oid="g3tl3__">
                <div
                  className="flex items-center justify-between mb-3"
                  data-oid="bkh_-yk"
                >
                  <h3
                    className="font-serif text-lg font-semibold text-wood-dark"
                    data-oid="bbw7e:0"
                  >
                    {quarter === "TBD" ? "To Be Determined" : quarter}
                  </h3>
                  <div className="text-sm text-sepia" data-oid="03g1nzi">
                    <span className="tabular-nums" data-oid="f:623t3">
                      {formatCurrency(quarterSpent)}
                    </span>
                    <span className="mx-1" data-oid="z2oj8sc">
                      /
                    </span>
                    <span className="tabular-nums" data-oid="6c00exf">
                      {formatCurrency(quarterTotal)}
                    </span>
                  </div>
                </div>
                <div className="space-y-3" data-oid="mitn2l9">
                  {quarterEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      expenses={expensesByEvent[event.id]}
                      expandable={expandable}
                      data-oid="kfjpfm5"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Flat list
        <div className="space-y-3" data-oid="cib4az.">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              expenses={expensesByEvent[event.id]}
              expandable={expandable}
              data-oid="iu2emu2"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default EventList;
