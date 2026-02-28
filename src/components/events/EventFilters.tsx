"use client";

import { useState, useEffect } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { QuarterType, EventTypeRecord } from "@/types/database";

/* ============================================
   EVENT FILTERS COMPONENT
   ============================================
   Ghostly-themed filter controls for the events list.
   Includes dropdowns for event type, quarter, and fiscal year.
   ============================================ */

export interface EventFiltersProps {
  /** Currently selected event type ID filter */
  selectedTypeId: string | "all";
  /** Currently selected quarter filter */
  selectedQuarter: QuarterType | "all";
  /** Called when event type filter changes */
  onTypeChange: (typeId: string | "all") => void;
  /** Called when quarter filter changes */
  onQuarterChange: (quarter: QuarterType | "all") => void;
  /** Called when filters are cleared */
  onClearFilters: () => void;
  /** Number of active filters */
  activeFilterCount?: number;
}

const quarters: QuarterType[] = ["Q1", "Q2", "Q3", "Q4", "TBD"];

export function EventFilters({
  selectedTypeId,
  selectedQuarter,
  onTypeChange,
  onQuarterChange,
  onClearFilters,
  activeFilterCount = 0,
}: EventFiltersProps) {
  const [eventTypes, setEventTypes] = useState<EventTypeRecord[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        // Fetch current fiscal year from settings
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
      } finally {
        setLoadingTypes(false);
      }
    };
    fetchEventTypes();
  }, []);

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

  const hasActiveFilters =
    selectedTypeId !== "all" || selectedQuarter !== "all";

  // Get the selected event type name for display
  const selectedTypeName =
    selectedTypeId !== "all"
      ? eventTypes.find((t) => t.id === selectedTypeId)?.name || "Unknown"
      : null;

  return (
    <div
      className="flex flex-col sm:flex-row gap-3 items-start sm:items-center"
      data-oid="7ul_yfa"
    >
      {/* Filter icon and label */}
      <div className="flex items-center gap-2 text-muted-foreground" data-oid="o7.an.n">
        <Filter className="w-4 h-4" data-oid="3xd_49l" />
        <span className="text-sm font-medium" data-oid="l8b3vjm">
          Filters:
        </span>
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap gap-3" data-oid="21zlutu">
        {/* Event Type Filter */}
        <div className="flex items-center gap-2" data-oid="a3kkqn7">
          <label htmlFor="filter-type" className="sr-only" data-oid="9ox5.9f">
            Filter by Event Type
          </label>
          <select
            id="filter-type"
            value={selectedTypeId}
            onChange={(e) => onTypeChange(e.target.value)}
            className={selectClasses}
            disabled={loadingTypes}
            data-oid="9koz0qs"
          >
            <option value="all" data-oid="_-wp353">
              {loadingTypes ? "Loading..." : "All Types"}
            </option>
            {eventTypes.map((type) => (
              <option key={type.id} value={type.id} data-oid="mqxhe9l">
                {type.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quarter Filter */}
        <div className="flex items-center gap-2" data-oid="62-h_l:">
          <label
            htmlFor="filter-quarter"
            className="sr-only"
            data-oid="sdw265b"
          >
            Filter by Quarter
          </label>
          <select
            id="filter-quarter"
            value={selectedQuarter}
            onChange={(e) =>
              onQuarterChange(e.target.value as QuarterType | "all")
            }
            className={selectClasses}
            data-oid="wz3i5c_"
          >
            <option value="all" data-oid="lrekq0u">
              All Quarters
            </option>
            {quarters.map((q) => (
              <option key={q} value={q} data-oid="vwro_bs">
                {q}
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
            data-oid="cxh78g9"
          >
            <X className="w-4 h-4 mr-1" data-oid="sx.gjpq" />
            Clear
            {activeFilterCount > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 text-xs bg-red-400/10 text-destructive rounded"
                data-oid="28:h0xq"
              >
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ============================================
   ACTIVE FILTER PILLS
   ============================================
   Optional component to show active filters as removable pills.
   ============================================ */

export interface FilterPillsProps {
  selectedTypeId: string | "all";
  selectedTypeName: string | null;
  selectedQuarter: QuarterType | "all";
  onRemoveType: () => void;
  onRemoveQuarter: () => void;
}

export function FilterPills({
  selectedTypeId,
  selectedTypeName,
  selectedQuarter,
  onRemoveType,
  onRemoveQuarter,
}: FilterPillsProps) {
  if (selectedTypeId === "all" && selectedQuarter === "all") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3" data-oid="4chdgzv">
      {selectedTypeId !== "all" && selectedTypeName && (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-spectral/10 text-sm text-foreground border border-border"
          data-oid="b1uhyk_"
        >
          Type: {selectedTypeName}
          <button
            onClick={onRemoveType}
            className="ml-0.5 p-0.5 rounded-full hover:bg-spectral/10 transition-colors"
            aria-label={`Remove ${selectedTypeName} filter`}
            data-oid="y4eoevg"
          >
            <X className="w-3 h-3" data-oid="n2qjid4" />
          </button>
        </span>
      )}

      {selectedQuarter !== "all" && (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-spectral/10 text-sm text-foreground border border-border"
          data-oid="50wbaaa"
        >
          Quarter: {selectedQuarter}
          <button
            onClick={onRemoveQuarter}
            className="ml-0.5 p-0.5 rounded-full hover:bg-spectral/10 transition-colors"
            aria-label={`Remove ${selectedQuarter} filter`}
            data-oid="gjs21:0"
          >
            <X className="w-3 h-3" data-oid="5x8stw7" />
          </button>
        </span>
      )}
    </div>
  );
}

export default EventFilters;
