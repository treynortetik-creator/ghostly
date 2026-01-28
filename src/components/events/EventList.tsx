'use client';

import { useState, useMemo } from 'react';
import { Calendar, AlertTriangle, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { EventCard } from './EventCard';
import { EventFilters, FilterPills } from './EventFilters';
import type { EventType, QuarterType, Expense } from '@/types/database';
import type { EventWithTotals } from '@/lib/mock-data/events';

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
  onFiltersChange?: (filters: { type: EventType | 'all'; quarter: QuarterType | 'all' }) => void;
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
  const [selectedType, setSelectedType] = useState<EventType | 'all'>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(e => e.event_type === selectedType);
    }

    // Apply quarter filter
    if (selectedQuarter !== 'all') {
      filtered = filtered.filter(e => e.quarter === selectedQuarter);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.location?.toLowerCase().includes(query) ||
        e.event_type.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [events, selectedType, selectedQuarter, searchQuery]);

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

    filteredEvents.forEach(event => {
      groups[event.quarter].push(event);
    });

    return groups;
  }, [filteredEvents, groupByQuarter]);

  // Count active filters
  const activeFilterCount = [
    selectedType !== 'all',
    selectedQuarter !== 'all',
  ].filter(Boolean).length;

  // Handle filter changes
  const handleTypeChange = (type: EventType | 'all') => {
    setSelectedType(type);
    onFiltersChange?.({ type, quarter: selectedQuarter });
  };

  const handleQuarterChange = (quarter: QuarterType | 'all') => {
    setSelectedQuarter(quarter);
    onFiltersChange?.({ type: selectedType, quarter });
  };

  const handleClearFilters = () => {
    setSelectedType('all');
    setSelectedQuarter('all');
    setSearchQuery('');
    onFiltersChange?.({ type: 'all', quarter: 'all' });
  };

  // Calculate totals
  const totals = useMemo(() => {
    return filteredEvents.reduce(
      (acc, event) => ({
        budget: acc.budget + event.budget_amount,
        actual: acc.actual + event.actual_spent,
        count: acc.count + 1,
      }),
      { budget: 0, actual: 0, count: 0 }
    );
  }, [filteredEvents]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-wood-medium/10 rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-24 bg-wood-medium/10 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="bg-ink-red/5 border-ink-red/20">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-12 h-12 text-ink-red mb-4" />
            <h3 className="font-serif text-xl font-semibold text-ink-red mb-2">
              Failed to Load Events
            </h3>
            <p className="text-sepia">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <EventFilters
          selectedType={selectedType}
          selectedQuarter={selectedQuarter}
          onTypeChange={handleTypeChange}
          onQuarterChange={handleQuarterChange}
          onClearFilters={handleClearFilters}
          activeFilterCount={activeFilterCount}
        />

        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sepia" />
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
            />
          </div>
        )}
      </div>

      {/* Active filter pills */}
      <FilterPills
        selectedType={selectedType}
        selectedQuarter={selectedQuarter}
        onRemoveType={() => handleTypeChange('all')}
        onRemoveQuarter={() => handleQuarterChange('all')}
      />

      {/* Summary stats */}
      <div className="flex flex-wrap items-center gap-4 py-3 px-4 bg-parchment-dark rounded-lg border border-wood-medium/20">
        <span className="text-sm text-sepia">
          <span className="font-semibold text-wood-dark">{totals.count}</span> events
        </span>
        <span className="text-wood-medium/30">|</span>
        <span className="text-sm text-sepia">
          Budget: <span className="font-semibold tabular-nums text-wood-dark">{formatCurrency(totals.budget)}</span>
        </span>
        <span className="text-wood-medium/30">|</span>
        <span className="text-sm text-sepia">
          Spent: <span className="font-semibold tabular-nums text-wood-dark">{formatCurrency(totals.actual)}</span>
        </span>
        <span className="text-wood-medium/30">|</span>
        <span className="text-sm text-sepia">
          Remaining:{' '}
          <span
            className={`font-semibold tabular-nums ${
              totals.budget - totals.actual < 0 ? 'text-ink-red' : 'text-ink-green'
            }`}
          >
            {formatCurrency(totals.budget - totals.actual)}
          </span>
        </span>
      </div>

      {/* Events list */}
      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Calendar className="w-12 h-12 text-sepia/40 mb-4" />
              <h3 className="font-serif text-xl font-semibold text-wood-dark mb-2">
                No Events Found
              </h3>
              <p className="text-sepia">
                {searchQuery || activeFilterCount > 0
                  ? 'Try adjusting your filters or search query.'
                  : 'No events have been registered yet.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : groupByQuarter && groupedEvents ? (
        // Grouped by quarter
        <div className="space-y-6">
          {(['Q1', 'Q2', 'Q3', 'Q4', 'TBD'] as QuarterType[]).map(quarter => {
            const quarterEvents = groupedEvents[quarter];
            if (quarterEvents.length === 0) return null;

            const quarterTotal = quarterEvents.reduce((sum, e) => sum + e.budget_amount, 0);
            const quarterSpent = quarterEvents.reduce((sum, e) => sum + e.actual_spent, 0);

            return (
              <div key={quarter}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif text-lg font-semibold text-wood-dark">
                    {quarter === 'TBD' ? 'To Be Determined' : quarter}
                  </h3>
                  <div className="text-sm text-sepia">
                    <span className="tabular-nums">{formatCurrency(quarterSpent)}</span>
                    <span className="mx-1">/</span>
                    <span className="tabular-nums">{formatCurrency(quarterTotal)}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {quarterEvents.map(event => (
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
          {filteredEvents.map(event => (
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
