'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  Users,
  Handshake,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, StatCard } from '@/components/ui/Card';
import { eventTypeLabels } from '@/types/database';
import type { EventType } from '@/types/database';

interface EventROIRow {
  id: string;
  name: string;
  event_type: EventType;
  pipeline_generated: number;
  revenue_closed: number;
  leads_generated: number;
  meetings_booked: number;
  opportunities_created: number;
  actual_spent: number;
  roi_ratio: number | null;
}

interface EventTypeBreakdown {
  event_type: EventType;
  event_count: number;
  total_spent: number;
  total_pipeline: number;
  total_revenue: number;
  total_leads: number;
  total_meetings: number;
  total_opportunities: number;
  roi_ratio: number | null;
}

interface ROIDashboardData {
  totals: {
    total_spent: number;
    total_pipeline: number;
    total_revenue: number;
    total_leads: number;
    total_meetings: number;
    total_opportunities: number;
    overall_roi_ratio: number | null;
    event_count: number;
  };
  events: EventROIRow[];
  by_event_type: EventTypeBreakdown[];
}

const typeColorClasses: Record<string, string> = {
  executive: 'bg-ink-gold/15 text-ink-gold border-ink-gold/30',
  national: 'bg-ink-green/15 text-ink-green border-ink-green/30',
  state: 'bg-wood-medium/15 text-wood-dark border-wood-medium/30',
  regional: 'bg-sepia/15 text-sepia border-sepia/30',
  customer: 'bg-ink-red/15 text-ink-red border-ink-red/30',
};

export default function ROIDashboardPage() {
  const [data, setData] = useState<ROIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/roi');
      if (!response.ok) throw new Error('Failed to fetch ROI data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatPercent = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${(value * 100).toFixed(1)}%`;
  };

  const roiTrend = (value: number | null) => {
    if (value === null) return 'neutral' as const;
    if (value > 0.05) return 'positive' as const;
    if (value < -0.05) return 'negative' as const;
    return 'neutral' as const;
  };

  const roiCellColor = (value: number | null) => {
    if (value === null) return 'text-sepia';
    if (value > 0.05) return 'text-ink-green';
    if (value < -0.05) return 'text-ink-red';
    return 'text-ink-gold';
  };

  if (loading) {
    return (
      <AppShell>
        <div className="animate-pulse space-y-6">
          <div className="h-9 w-64 bg-wood-medium/20 rounded mb-2" />
          <div className="h-5 w-80 bg-wood-medium/10 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-wood-medium/10 rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-wood-medium/10 rounded-lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <Card className="bg-ink-red/5 border-ink-red/20">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertTriangle className="w-12 h-12 text-ink-red mb-4" />
              <h3 className="font-serif text-xl font-semibold text-ink-red mb-2">
                Failed to Load ROI Dashboard
              </h3>
              <p className="text-sepia mb-6">{error || 'No data available'}</p>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-wood-dark">
            Return on Investment
          </h1>
          <p className="mt-1 text-sepia">
            Event ROI performance across {data.totals.event_count} events
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Spend"
            value={formatCurrency(data.totals.total_spent)}
            subtitle={`${data.totals.event_count} events`}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            title="Total Pipeline"
            value={formatCurrency(data.totals.total_pipeline)}
            subtitle={`${data.totals.total_leads} leads generated`}
            icon={<Briefcase className="w-5 h-5" />}
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(data.totals.total_revenue)}
            subtitle={`${data.totals.total_opportunities} opportunities`}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            title="Overall ROI"
            value={formatPercent(data.totals.overall_roi_ratio)}
            subtitle={data.totals.overall_roi_ratio !== null ? (data.totals.overall_roi_ratio > 0 ? 'Positive return' : data.totals.overall_roi_ratio < 0 ? 'Net loss' : 'Break-even') : 'No spend data'}
            trend={roiTrend(data.totals.overall_roi_ratio)}
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        {/* Event Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>ROI by Event Type</CardTitle>
            <CardDescription>Performance breakdown across event categories</CardDescription>
          </CardHeader>
          <CardContent>
            {data.by_event_type.length === 0 ? (
              <p className="text-center text-sepia py-4">No event data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wood-medium/20">
                      <th className="text-left py-2 pr-4 font-medium text-wood-dark">Type</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Events</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Spent</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Pipeline</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Leads</th>
                      <th className="text-right py-2 pl-3 font-medium text-wood-dark">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_event_type.map((row) => (
                      <tr key={row.event_type} className="border-b border-wood-medium/10 hover:bg-parchment/50">
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${typeColorClasses[row.event_type]}`}>
                            {eventTypeLabels[row.event_type]}
                          </span>
                        </td>
                        <td className="text-right py-3 px-3 tabular-nums">{row.event_count}</td>
                        <td className="text-right py-3 px-3 tabular-nums">{formatCurrency(row.total_spent)}</td>
                        <td className="text-right py-3 px-3 tabular-nums">{formatCurrency(row.total_pipeline)}</td>
                        <td className="text-right py-3 px-3 tabular-nums">{formatCurrency(row.total_revenue)}</td>
                        <td className="text-right py-3 px-3 tabular-nums">{row.total_leads}</td>
                        <td className={`text-right py-3 pl-3 tabular-nums font-semibold ${roiCellColor(row.roi_ratio)}`}>
                          {formatPercent(row.roi_ratio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Events Table sorted by ROI */}
        <Card>
          <CardHeader>
            <CardTitle>Event Performance</CardTitle>
            <CardDescription>All events sorted by ROI (best performing first)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.events.length === 0 ? (
              <p className="text-center text-sepia py-8">No events found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wood-medium/20">
                      <th className="text-left py-2 pr-4 font-medium text-wood-dark">Event</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Spent</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Pipeline</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Leads</th>
                      <th className="text-right py-2 px-3 font-medium text-wood-dark">Meetings</th>
                      <th className="text-right py-2 pl-3 font-medium text-wood-dark">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((event) => (
                      <tr key={event.id} className="border-b border-wood-medium/10 hover:bg-parchment/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/events/${event.id}`}
                              className="font-medium text-wood-dark hover:text-ink-gold transition-colors"
                            >
                              {event.name}
                            </Link>
                            <ArrowUpRight className="w-3 h-3 text-sepia/50" />
                          </div>
                          <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium border ${typeColorClasses[event.event_type]}`}>
                            {eventTypeLabels[event.event_type]}
                          </span>
                        </td>
                        <td className="text-right py-3 px-3 tabular-nums">{formatCurrency(event.actual_spent)}</td>
                        <td className="text-right py-3 px-3 tabular-nums">{formatCurrency(event.pipeline_generated)}</td>
                        <td className="text-right py-3 px-3 tabular-nums">{formatCurrency(event.revenue_closed)}</td>
                        <td className="text-right py-3 px-3 tabular-nums">{event.leads_generated}</td>
                        <td className="text-right py-3 px-3 tabular-nums">{event.meetings_booked}</td>
                        <td className={`text-right py-3 pl-3 tabular-nums font-semibold ${roiCellColor(event.roi_ratio)}`}>
                          {formatPercent(event.roi_ratio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
