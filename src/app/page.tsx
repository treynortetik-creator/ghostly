'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, BudgetProgress } from '@/components/ui';
import { BudgetOverviewCard, EventTypeSummary, QuarterSummary } from '@/components/dashboard';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { EventType, QuarterType } from '@/types/database';

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
    type: EventType;
    budget: number;
    actual: number;
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
    <div className="animate-pulse space-y-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-9 w-48 bg-wood-medium/20 rounded mb-2" />
        <div className="h-5 w-72 bg-wood-medium/10 rounded" />
      </div>

      {/* Overview card skeleton */}
      <div className="h-64 bg-wood-medium/10 rounded-lg" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96 bg-wood-medium/10 rounded-lg" />
        <div className="h-96 bg-wood-medium/10 rounded-lg" />
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="bg-ink-red/5 border-ink-red/20">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-12 h-12 text-ink-red mb-4" />
          <h3 className="font-serif text-xl font-semibold text-ink-red mb-2">
            Failed to Load Dashboard
          </h3>
          <p className="text-sepia mb-6 max-w-md">
            {error}
          </p>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-wood-dark text-parchment rounded-lg hover:bg-wood-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
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
      const response = await fetch('/api/dashboard/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const summary = await response.json();
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Format date for header
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <AppShell>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-wood-dark">
          The Ledger
        </h1>
        <p className="mt-1 text-sepia">
          FY 2026 Budget Overview &middot; As of {formattedDate}
        </p>
      </div>

      {/* Loading State */}
      {loading && <DashboardSkeleton />}

      {/* Error State */}
      {error && !loading && (
        <DashboardError error={error} onRetry={fetchDashboardData} />
      )}

      {/* Dashboard Content */}
      {data && !loading && (
        <div className="space-y-8">
          {/* Budget Overview Card */}
          <BudgetOverviewCard
            budget={data.total.budget}
            allocated={data.total.allocated}
            actual={data.total.actual}
            remaining={data.total.remaining}
          />

          {/* Event Type and Quarter Summary Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Event Type Summary */}
            <EventTypeSummary data={data.byEventType} />

            {/* Quarter Summary */}
            <QuarterSummary data={data.byQuarter} />
          </div>

          {/* Budget Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Categories</CardTitle>
              <CardDescription>
                Non-event operational budget allocations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.byCategory.map((category) => (
                <BudgetProgress
                  key={category.name}
                  label={category.name}
                  spent={category.actual}
                  budget={category.budget}
                />
              ))}
            </CardContent>
          </Card>

          {/* Footer Info */}
          <div className="text-center py-4">
            <p className="text-xs text-sepia/60">
              Data refreshes automatically. Last updated: {new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
