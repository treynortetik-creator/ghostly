"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  BudgetProgress,
} from "@/components/ui";
import {
  BudgetOverviewCard,
  EventTypeSummary,
  QuarterSummary,
} from "@/components/dashboard";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { QuarterType } from "@/types/database";

/* ============================================
   DASHBOARD PAGE - THE LEDGER
   ============================================
   Main dashboard showing budget overview with:
   - Total budget vs actual
   - Budget by event type
   - Budget by quarter
   - Budget categories
   ============================================ */

// Dashboard API response type
interface DashboardSummary {
  total: {
    budget: number;
    allocated: number;
    actual: number;
    remaining: number;
  };
  byEventType: {
    id: string;
    type: string;
    budget: number;
    actual: number;
    description: string | null;
  }[];
  byQuarter: {
    quarter: QuarterType;
    budget: number;
    actual: number;
  }[];
  byCategory: {
    name: string;
    budget: number;
    actual: number;
  }[];
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8" data-oid="an55u9i">
      {/* Header skeleton */}
      <div className="mb-8" data-oid="em025ko">
        <div
          className="h-9 w-48 bg-spectral/10 rounded mb-2"
          data-oid="_pp0log"
        />
        <div
          className="h-5 w-72 bg-spectral/10 rounded"
          data-oid="96fpe:w"
        />
      </div>

      {/* Overview card skeleton */}
      <div className="h-64 bg-spectral/10 rounded-lg" data-oid="-o7.k8g" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-oid="vbf7k4z">
        <div className="h-96 bg-spectral/10 rounded-lg" data-oid="4us5506" />
        <div className="h-96 bg-spectral/10 rounded-lg" data-oid="azoc9fq" />
      </div>
    </div>
  );
}

function DashboardError({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <Card className="bg-red-400/10 border-destructive/20" data-oid="4-qawl4">
      <CardContent className="py-12" data-oid="3gkims.">
        <div
          className="flex flex-col items-center justify-center text-center"
          data-oid="e63.dzi"
        >
          <AlertTriangle
            className="w-12 h-12 text-destructive mb-4"
            data-oid="dlt7s4o"
          />
          <h3
            className="text-xl font-semibold text-destructive mb-2"
            data-oid="x0-:gp9"
          >
            Failed to Load Dashboard
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md" data-oid="zo2h6_t">
            {error}
          </p>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-ghost-dark text-phantom rounded-lg hover:bg-ghost-light transition-colors"
            data-oid="xo-_vot"
          >
            <RefreshCw className="w-4 h-4" data-oid="oj:mjow" />
            Try Again
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard/summary");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      const summary = await response.json();
      setData(summary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Format date for header
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppShell data-oid=":vq9-o7">
      {/* Page Header */}
      <div className="mb-8" data-oid="aoaw53b">
        <h1
          className="text-3xl font-bold text-foreground"
          data-oid="::-yhcp"
        >
          The Ledger
        </h1>
        <p className="mt-1 text-muted-foreground" data-oid="l2cv1u8">
          FY {new Date().getFullYear()} Budget Overview &middot; As of{" "}
          {formattedDate}
        </p>
      </div>

      {/* Loading State */}
      {loading && <DashboardSkeleton data-oid="msk-joy" />}

      {/* Error State */}
      {error && !loading && (
        <DashboardError
          error={error}
          onRetry={fetchDashboardData}
          data-oid="843vwlz"
        />
      )}

      {/* Dashboard Content */}
      {data && !loading && (
        <div className="space-y-8" data-oid="u7rzkwi">
          {/* Budget Overview Card */}
          <BudgetOverviewCard
            budget={data.total.budget}
            allocated={data.total.allocated}
            actual={data.total.actual}
            remaining={data.total.remaining}
            data-oid="y_wn::n"
          />

          {/* Event Type and Quarter Summary Grid */}
          <div
            className="grid grid-cols-1 xl:grid-cols-2 gap-6"
            data-oid=":_wb8pl"
          >
            {/* Event Type Summary */}
            <EventTypeSummary data={data.byEventType} data-oid="e3lw57t" />

            {/* Quarter Summary */}
            <QuarterSummary data={data.byQuarter} data-oid="w9r8bvv" />
          </div>

          {/* Budget Categories */}
          <Card data-oid="u7x4:7d">
            <CardHeader data-oid="v:.88ib">
              <CardTitle data-oid=".2anf36">Budget Categories</CardTitle>
              <CardDescription data-oid="obt2:iq">
                Non-event operational budget allocations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4" data-oid="7_39c.k">
              {data.byCategory.map((category) => (
                <BudgetProgress
                  key={category.name}
                  label={category.name}
                  spent={category.actual}
                  budget={category.budget}
                  data-oid="x90q.9:"
                />
              ))}
            </CardContent>
          </Card>

          {/* Footer Info */}
          <div className="text-center py-4" data-oid="37pge2r">
            <p className="text-xs text-muted-foreground/60" data-oid="o4l7alh">
              Data refreshes automatically. Last updated:{" "}
              {new Date().toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
