"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  Users,
  Handshake,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  StatCard,
} from "@/components/ui/Card";
import { eventTypeLabels } from "@/types/database";
import { formatCurrency } from "@/lib/format";
import type { EventType } from "@/types/database";

interface EventROIRow {
  id: string;
  name: string;
  event_type_id: string | null;
  event_type_record: { name: string } | null;
  pipeline_generated: number;
  revenue_closed: number;
  leads_generated: number;
  meetings_booked: number;
  opportunities_created: number;
  actual_spent: number;
  roi_ratio: number | null;
}

interface EventTypeBreakdown {
  event_type: string;
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
  executive: "bg-spectral/10 text-spectral border-spectral",
  national: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
  state: "bg-spectral/10 text-foreground border-border",
  regional: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  customer: "bg-red-400/10 text-destructive border-destructive/30",
};

export default function ROIDashboardPage() {
  const [data, setData] = useState<ROIDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/roi");
      if (!response.ok) throw new Error("Failed to fetch ROI data");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatPercent = (value: number | null) => {
    if (value === null) return "N/A";
    return `${(value * 100).toFixed(1)}%`;
  };

  const roiTrend = (value: number | null) => {
    if (value === null) return "neutral" as const;
    if (value > 0.05) return "positive" as const;
    if (value < -0.05) return "negative" as const;
    return "neutral" as const;
  };

  const roiCellColor = (value: number | null) => {
    if (value === null) return "text-muted-foreground";
    if (value > 0.05) return "text-emerald-400";
    if (value < -0.05) return "text-destructive";
    return "text-spectral";
  };

  if (loading) {
    return (
      <AppShell data-oid="vuo9.t0">
        <div className="animate-pulse space-y-6" data-oid="8x.7mzd">
          <div
            className="h-9 w-64 bg-spectral/10 rounded mb-2"
            data-oid="kx-kref"
          />
          <div
            className="h-5 w-80 bg-spectral/10 rounded"
            data-oid="k8i38_r"
          />
          <div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            data-oid="-42572-"
          >
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-32 bg-spectral/10 rounded-lg"
                data-oid="gom.gos"
              />
            ))}
          </div>
          <div
            className="h-96 bg-spectral/10 rounded-lg"
            data-oid="wanfkf1"
          />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell data-oid="jy2313y">
        <Card className="bg-red-400/10 border-destructive/20" data-oid="t_k6otu">
          <CardContent className="py-12" data-oid="tg41oej">
            <div
              className="flex flex-col items-center justify-center text-center"
              data-oid="4kpo1oh"
            >
              <AlertTriangle
                className="w-12 h-12 text-destructive mb-4"
                data-oid="grl7zjg"
              />
              <h3
                className="text-xl font-semibold text-destructive mb-2"
                data-oid="ym4lp9i"
              >
                Failed to Load ROI Dashboard
              </h3>
              <p className="text-muted-foreground mb-6" data-oid="swlknaw">
                {error || "No data available"}
              </p>
              <Button
                variant="secondary"
                onClick={fetchData}
                data-oid="z:ng8n5"
              >
                <RefreshCw className="w-4 h-4 mr-2" data-oid="y.c.zx7" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell data-oid="0fd2rj8">
      {/* Page Header */}
      <div
        className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8"
        data-oid="d8np9kr"
      >
        <div data-oid="5wcog6x">
          <h1
            className="text-3xl font-bold text-foreground"
            data-oid="xek0g.-"
          >
            Return on Investment
          </h1>
          <p className="mt-1 text-muted-foreground" data-oid="6_usjq2">
            Event ROI performance across {data.totals.event_count} events
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchData}
          data-oid="o74c6_c"
        >
          <RefreshCw className="w-4 h-4 mr-2" data-oid="f-_vc3-" />
          Refresh
        </Button>
      </div>

      <div className="space-y-8" data-oid="g7wqp-w">
        {/* Summary Cards */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          data-oid="h7o501b"
        >
          <StatCard
            title="Total Spend"
            value={formatCurrency(data.totals.total_spent)}
            subtitle={`${data.totals.event_count} events`}
            icon={<DollarSign className="w-5 h-5" data-oid="fnj_zmh" />}
            data-oid="w20dioj"
          />

          <StatCard
            title="Total Pipeline"
            value={formatCurrency(data.totals.total_pipeline)}
            subtitle={`${data.totals.total_leads} leads generated`}
            icon={<Briefcase className="w-5 h-5" data-oid="d3lhz-g" />}
            data-oid="ri.mmn0"
          />

          <StatCard
            title="Total Revenue"
            value={formatCurrency(data.totals.total_revenue)}
            subtitle={`${data.totals.total_opportunities} opportunities`}
            icon={<TrendingUp className="w-5 h-5" data-oid="knogshh" />}
            data-oid="h6q3gpd"
          />

          <StatCard
            title="Overall ROI"
            value={formatPercent(data.totals.overall_roi_ratio)}
            subtitle={
              data.totals.overall_roi_ratio !== null
                ? data.totals.overall_roi_ratio > 0
                  ? "Positive return"
                  : data.totals.overall_roi_ratio < 0
                    ? "Net loss"
                    : "Break-even"
                : "No spend data"
            }
            trend={roiTrend(data.totals.overall_roi_ratio)}
            icon={<TrendingUp className="w-5 h-5" data-oid=".5vw7gm" />}
            data-oid="94-mams"
          />
        </div>

        {/* Event Type Breakdown */}
        <Card data-oid="y:570l_">
          <CardHeader data-oid="umoc-7o">
            <CardTitle data-oid="jkec1bn">ROI by Event Type</CardTitle>
            <CardDescription data-oid="l1-1prz">
              Performance breakdown across event categories
            </CardDescription>
          </CardHeader>
          <CardContent data-oid="_f2fit1">
            {data.by_event_type.length === 0 ? (
              <p className="text-center text-muted-foreground py-4" data-oid="q3s2dmx">
                No event data available.
              </p>
            ) : (
              <div className="overflow-x-auto" data-oid="243j68n">
                <table className="w-full text-sm" data-oid="vd1vt6-">
                  <thead data-oid="f1i.plo">
                    <tr
                      className="border-b border-border"
                      data-oid="i1kwjyn"
                    >
                      <th
                        className="text-left py-2 pr-4 font-medium text-foreground"
                        data-oid="v4zolie"
                      >
                        Type
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid="oieg.6f"
                      >
                        Events
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid="x3abbmy"
                      >
                        Spent
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid="ysb1.1h"
                      >
                        Pipeline
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid="3tii3q6"
                      >
                        Revenue
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid=":q_c8u9"
                      >
                        Leads
                      </th>
                      <th
                        className="text-right py-2 pl-3 font-medium text-foreground"
                        data-oid="5wpi5w0"
                      >
                        ROI
                      </th>
                    </tr>
                  </thead>
                  <tbody data-oid="vqlnh9u">
                    {data.by_event_type.map((row) => (
                      <tr
                        key={row.event_type || 'unknown'}
                        className="border-b border-border hover:bg-background/50"
                        data-oid="rz3s8nl"
                      >
                        <td className="py-3 pr-4" data-oid="lq9rqye">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${typeColorClasses[row.event_type?.toLowerCase?.()] || 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30'}`}
                            data-oid="nva0wc1"
                          >
                            {row.event_type || 'Uncategorized'}
                          </span>
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="cgcgolg"
                        >
                          {row.event_count}
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="c7qhlvt"
                        >
                          {formatCurrency(row.total_spent)}
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="xvazba:"
                        >
                          {formatCurrency(row.total_pipeline)}
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="d5foa9b"
                        >
                          {formatCurrency(row.total_revenue)}
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="0maj4yz"
                        >
                          {row.total_leads}
                        </td>
                        <td
                          className={`text-right py-3 pl-3 tabular-nums font-semibold ${roiCellColor(row.roi_ratio)}`}
                          data-oid="xmsgx4x"
                        >
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
        <Card data-oid="t8l70cb">
          <CardHeader data-oid="b27azn:">
            <CardTitle data-oid=".58hs85">Event Performance</CardTitle>
            <CardDescription data-oid="tbbnd1_">
              All events sorted by ROI (best performing first)
            </CardDescription>
          </CardHeader>
          <CardContent data-oid="80hs8:1">
            {data.events.length === 0 ? (
              <p className="text-center text-muted-foreground py-8" data-oid="w8x3yq8">
                No events found.
              </p>
            ) : (
              <div className="overflow-x-auto" data-oid="o1959w.">
                <table className="w-full text-sm" data-oid="tstu2k:">
                  <thead data-oid="aynirkj">
                    <tr
                      className="border-b border-border"
                      data-oid="w3g2rl6"
                    >
                      <th
                        className="text-left py-2 pr-4 font-medium text-foreground"
                        data-oid="6t60g5o"
                      >
                        Event
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid="j0rbzu."
                      >
                        Spent
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid="eozr683"
                      >
                        Pipeline
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid="v3jui7o"
                      >
                        Revenue
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid=".6v:_lj"
                      >
                        Leads
                      </th>
                      <th
                        className="text-right py-2 px-3 font-medium text-foreground"
                        data-oid="fvc8k1d"
                      >
                        Meetings
                      </th>
                      <th
                        className="text-right py-2 pl-3 font-medium text-foreground"
                        data-oid="497:bym"
                      >
                        ROI
                      </th>
                    </tr>
                  </thead>
                  <tbody data-oid="cc4m7p5">
                    {data.events.map((event) => (
                      <tr
                        key={event.id}
                        className="border-b border-border hover:bg-background/50"
                        data-oid="i_1bpek"
                      >
                        <td className="py-3 pr-4" data-oid="p3fuggo">
                          <div
                            className="flex items-center gap-2"
                            data-oid="1rz-akh"
                          >
                            <Link
                              href={`/events/${event.id}`}
                              className="font-medium text-foreground hover:text-spectral transition-colors"
                              data-oid="2g8hx5t"
                            >
                              {event.name}
                            </Link>
                            <ArrowUpRight
                              className="w-3 h-3 text-muted-foreground/60"
                              data-oid="-l:5:oc"
                            />
                          </div>
                          <span
                            className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium border ${typeColorClasses[event.event_type_record?.name?.toLowerCase() ?? ''] || 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30'}`}
                            data-oid="3dal06v"
                          >
                            {event.event_type_record?.name ?? 'Uncategorized'}
                          </span>
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="mwvq11f"
                        >
                          {formatCurrency(event.actual_spent)}
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="rinbgc4"
                        >
                          {formatCurrency(event.pipeline_generated)}
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="s7ymgqk"
                        >
                          {formatCurrency(event.revenue_closed)}
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="_zuf.af"
                        >
                          {event.leads_generated}
                        </td>
                        <td
                          className="text-right py-3 px-3 tabular-nums"
                          data-oid="pk9a609"
                        >
                          {event.meetings_booked}
                        </td>
                        <td
                          className={`text-right py-3 pl-3 tabular-nums font-semibold ${roiCellColor(event.roi_ratio)}`}
                          data-oid="cob-lv:"
                        >
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
