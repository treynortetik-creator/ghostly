'use client';

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { EventType, QuarterType } from '@/types/database';
import { eventTypeLabels, quarterLabels } from '@/lib/mock-data/events';

/* ============================================
   EVENT FILTERS COMPONENT
   ============================================
   Victorian-styled filter controls for the events list.
   Includes dropdowns for event type, quarter, and fiscal year.
   ============================================ */

export interface EventFiltersProps {
  /** Currently selected event type filter */
  selectedType: EventType | 'all';
  /** Currently selected quarter filter */
  selectedQuarter: QuarterType | 'all';
  /** Called when event type filter changes */
  onTypeChange: (type: EventType | 'all') => void;
  /** Called when quarter filter changes */
  onQuarterChange: (quarter: QuarterType | 'all') => void;
  /** Called when filters are cleared */
  onClearFilters: () => void;
  /** Number of active filters */
  activeFilterCount?: number;
}

const eventTypes: EventType[] = ['executive', 'national', 'state', 'regional', 'customer'];
const quarters: QuarterType[] = ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'];

export function EventFilters({
  selectedType,
  selectedQuarter,
  onTypeChange,
  onQuarterChange,
  onClearFilters,
  activeFilterCount = 0,
}: EventFiltersProps) {
  const selectClasses = `
    px-3 py-2 rounded-md
    bg-parchment border border-wood-medium/40
    text-ink-black text-sm
    focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold
    transition-colors duration-200
    cursor-pointer
    appearance-none
    bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%235c3d2e%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]
    bg-[length:16px]
    bg-[right_8px_center]
    bg-no-repeat
    pr-8
  `;

  const hasActiveFilters = selectedType !== 'all' || selectedQuarter !== 'all';

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Filter icon and label */}
      <div className="flex items-center gap-2 text-sepia">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters:</span>
      </div>

      {/* Filter dropdowns */}
      <div className="flex flex-wrap gap-3">
        {/* Event Type Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-type" className="sr-only">
            Filter by Event Type
          </label>
          <select
            id="filter-type"
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as EventType | 'all')}
            className={selectClasses}
          >
            <option value="all">All Types</option>
            {eventTypes.map(type => (
              <option key={type} value={type}>
                {eventTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Quarter Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-quarter" className="sr-only">
            Filter by Quarter
          </label>
          <select
            id="filter-quarter"
            value={selectedQuarter}
            onChange={(e) => onQuarterChange(e.target.value as QuarterType | 'all')}
            className={selectClasses}
          >
            <option value="all">All Quarters</option>
            {quarters.map(q => (
              <option key={q} value={q}>
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
            className="text-sepia hover:text-ink-red"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-ink-red/10 text-ink-red rounded">
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
  selectedType: EventType | 'all';
  selectedQuarter: QuarterType | 'all';
  onRemoveType: () => void;
  onRemoveQuarter: () => void;
}

export function FilterPills({
  selectedType,
  selectedQuarter,
  onRemoveType,
  onRemoveQuarter,
}: FilterPillsProps) {
  if (selectedType === 'all' && selectedQuarter === 'all') {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {selectedType !== 'all' && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-wood-medium/10 text-sm text-wood-dark border border-wood-medium/20">
          Type: {eventTypeLabels[selectedType]}
          <button
            onClick={onRemoveType}
            className="ml-0.5 p-0.5 rounded-full hover:bg-wood-medium/20 transition-colors"
            aria-label={`Remove ${eventTypeLabels[selectedType]} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}

      {selectedQuarter !== 'all' && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-wood-medium/10 text-sm text-wood-dark border border-wood-medium/20">
          Quarter: {selectedQuarter}
          <button
            onClick={onRemoveQuarter}
            className="ml-0.5 p-0.5 rounded-full hover:bg-wood-medium/20 transition-colors"
            aria-label={`Remove ${selectedQuarter} filter`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      )}
    </div>
  );
}

export default EventFilters;
