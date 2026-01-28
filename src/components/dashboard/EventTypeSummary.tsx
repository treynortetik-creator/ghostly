'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, ProgressBar } from '@/components/ui';
import { Crown, Building2, MapPin, Map, Users } from 'lucide-react';
import type { EventType } from '@/types/database';

/* ============================================
   EVENT TYPE SUMMARY
   ============================================
   Displays budget breakdown by event type with
   Victorian-styled cards and progress bars.
   ============================================ */

export interface EventTypeData {
  type: EventType;
  budget: number;
  actual: number;
}

export interface EventTypeSummaryProps {
  data: EventTypeData[];
  className?: string;
}

// Event type display configuration
const eventTypeConfig: Record<
  EventType,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  executive: {
    label: 'Executive',
    icon: Crown,
    description: 'C-suite conferences and leadership events',
  },
  national: {
    label: 'National',
    icon: Building2,
    description: 'Industry-wide conferences and associations',
  },
  state: {
    label: 'State',
    icon: MapPin,
    description: 'State-level associations and regional events',
  },
  regional: {
    label: 'Regional',
    icon: Map,
    description: 'Multi-state regional gatherings',
  },
  customer: {
    label: 'Customer',
    icon: Users,
    description: 'Customer appreciation and engagement events',
  },
};

function EventTypeRow({ data }: { data: EventTypeData }) {
  const config = eventTypeConfig[data.type];
  const Icon = config.icon;
  const percentage = data.budget > 0 ? (data.actual / data.budget) * 100 : 0;
  const remaining = data.budget - data.actual;
  const isOverBudget = data.actual > data.budget;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStatusColor = () => {
    if (isOverBudget) return 'text-ink-red';
    if (percentage >= 80) return 'text-ink-gold';
    return 'text-ink-green';
  };

  // Skip event types with no budget
  if (data.budget === 0) {
    return null;
  }

  return (
    <div className="p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-wood-medium/10 text-wood-medium">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-ink-black">{config.label} Events</h4>
            <p className="text-xs text-sepia">{config.description}</p>
          </div>
        </div>
        <div className={`text-right ${getStatusColor()}`}>
          <p className="font-medium text-lg tabular-nums">{formatCurrency(remaining)}</p>
          <p className="text-xs">remaining</p>
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar
        value={data.actual}
        max={data.budget}
        size="md"
        animated={isOverBudget}
      />

      {/* Stats Row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-wood-medium/15 text-sm">
        <div>
          <span className="text-sepia">Spent: </span>
          <span className="font-medium tabular-nums text-ink-black">{formatCurrency(data.actual)}</span>
        </div>
        <div>
          <span className="text-sepia">Budget: </span>
          <span className="font-medium tabular-nums text-ink-black">{formatCurrency(data.budget)}</span>
        </div>
        <div className={`font-medium ${getStatusColor()}`}>
          {percentage.toFixed(0)}% used
        </div>
      </div>
    </div>
  );
}

export function EventTypeSummary({ data, className }: EventTypeSummaryProps) {
  // Filter out event types with zero budget
  const activeEventTypes = data.filter((d) => d.budget > 0);

  // Calculate totals for the event types
  const totalBudget = activeEventTypes.reduce((sum, d) => sum + d.budget, 0);
  const totalActual = activeEventTypes.reduce((sum, d) => sum + d.actual, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Budget by Event Type</CardTitle>
            <CardDescription>
              Spending breakdown across {activeEventTypes.length} event categories
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-sepia">Events Total</p>
            <p className="font-serif font-bold text-lg text-ink-black tabular-nums">
              {totalActual.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              <span className="text-sepia font-normal text-sm">
                {' '}/ {totalBudget.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeEventTypes.map((eventType) => (
          <EventTypeRow key={eventType.type} data={eventType} />
        ))}
      </CardContent>
    </Card>
  );
}

export default EventTypeSummary;
