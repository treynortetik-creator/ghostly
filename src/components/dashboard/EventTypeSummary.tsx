"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  ProgressBar,
} from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  Crown,
  Building2,
  MapPin,
  Map,
  Users,
  CalendarDays,
} from "lucide-react";

/* ============================================
   EVENT TYPE SUMMARY
   ============================================
   Displays budget breakdown by event type with
   Victorian-styled cards and progress bars.
   ============================================ */

export interface EventTypeData {
  id: string;
  type: string;
  budget: number;
  actual: number;
  description: string | null;
}

export interface EventTypeSummaryProps {
  data: EventTypeData[];
  className?: string;
}

// Legacy event type icon mapping (for backward compatibility with common names)
const eventTypeIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  executive: Crown,
  national: Building2,
  state: MapPin,
  regional: Map,
  customer: Users,
};

// Event type icon component - renders the appropriate icon based on type name
function EventTypeIcon({
  typeName,
  className,
}: {
  typeName: string;
  className?: string;
}) {
  const normalizedName = typeName.toLowerCase();
  const IconComponent = eventTypeIcons[normalizedName] || CalendarDays;
  return <IconComponent className={className} data-oid="1n--7_s" />;
}

function EventTypeRow({ data }: { data: EventTypeData }) {
  const percentage = data.budget > 0 ? (data.actual / data.budget) * 100 : 0;
  const remaining = data.budget - data.actual;
  const isOverBudget = data.actual > data.budget;

  const getStatusColor = () => {
    if (isOverBudget) return "text-ink-red";
    if (percentage >= 80) return "text-ink-gold";
    return "text-ink-green";
  };

  // Skip event types with no budget
  if (data.budget === 0) {
    return null;
  }

  return (
    <div
      className="p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
      data-oid="czilw_:"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3" data-oid="9kilj00">
        <div className="flex items-center gap-3" data-oid="yznbn:y">
          <div
            className="p-2 rounded-md bg-wood-medium/10 text-wood-medium"
            data-oid="czazt85"
          >
            <EventTypeIcon
              typeName={data.type}
              className="w-5 h-5"
              data-oid="q9:ytht"
            />
          </div>
          <div data-oid="23h4ygx">
            <h4 className="font-semibold text-ink-black" data-oid="g6d9c3d">
              {data.type} Events
            </h4>
            {data.description && (
              <p className="text-xs text-sepia" data-oid="uw_at-f">
                {data.description}
              </p>
            )}
          </div>
        </div>
        <div className={`text-right ${getStatusColor()}`} data-oid="3pqh2g3">
          <p className="font-medium text-lg tabular-nums" data-oid="krv6s8n">
            {formatCurrency(remaining)}
          </p>
          <p className="text-xs" data-oid="ptwig9p">
            remaining
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <ProgressBar
        value={data.actual}
        max={data.budget}
        size="md"
        animated={isOverBudget}
        data-oid=".__uwpt"
      />

      {/* Stats Row */}
      <div
        className="flex items-center justify-between mt-3 pt-3 border-t border-wood-medium/15 text-sm"
        data-oid="mp:xt9h"
      >
        <div data-oid="eqb2tc.">
          <span className="text-sepia" data-oid="x3:e4mv">
            Spent:{" "}
          </span>
          <span
            className="font-medium tabular-nums text-ink-black"
            data-oid="47kxbkw"
          >
            {formatCurrency(data.actual)}
          </span>
        </div>
        <div data-oid="6ymekcr">
          <span className="text-sepia" data-oid="aua1l08">
            Budget:{" "}
          </span>
          <span
            className="font-medium tabular-nums text-ink-black"
            data-oid="hlr59f9"
          >
            {formatCurrency(data.budget)}
          </span>
        </div>
        <div className={`font-medium ${getStatusColor()}`} data-oid="75hc.ua">
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
    <Card className={className} data-oid="w5iwyht">
      <CardHeader data-oid="nmm5yl8">
        <div className="flex items-center justify-between" data-oid="vttc-ej">
          <div data-oid="_d2:7tm">
            <CardTitle data-oid="hjspl4q">Budget by Event Type</CardTitle>
            <CardDescription data-oid="wk8pg5g">
              Spending breakdown across {activeEventTypes.length} event
              categories
            </CardDescription>
          </div>
          <div className="text-right" data-oid="u.qofrm">
            <p className="text-sm text-sepia" data-oid="ntufiez">
              Events Total
            </p>
            <p
              className="font-serif font-bold text-lg text-ink-black tabular-nums"
              data-oid="1maqpn4"
            >
              {formatCurrency(totalActual)}
              <span
                className="text-sepia font-normal text-sm"
                data-oid="m5f5f61"
              >
                {" "}
                /{" "}
                {formatCurrency(totalBudget)}
              </span>
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4" data-oid="dataarl">
        {activeEventTypes.map((eventType) => (
          <EventTypeRow
            key={eventType.id}
            data={eventType}
            data-oid="9is2om5"
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default EventTypeSummary;
