'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, DollarSign, CheckSquare } from 'lucide-react';

/* ============================================
   DASHBOARD ALERTS
   ============================================
   Quick-stats alert bar showing:
   - Overdue checklist items
   - Over-budget events
   - Events in the next 7 days
   ============================================ */

interface AlertData {
  overdueTaskCount: number;
  overBudgetEventCount: number;
  upcomingEventCount: number;
}

function AlertBadge({
  icon: Icon,
  label,
  count,
  variant,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  variant: 'danger' | 'warning' | 'info';
  href?: string;
}) {
  const variantStyles = {
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    warning: 'bg-spectral/10 text-spectral border-spectral/20',
    info: 'bg-ghost-light/10 text-ghost-light border-ghost-light/20',
  };

  const countStyles = {
    danger: 'bg-destructive text-white',
    warning: 'bg-spectral text-white',
    info: 'bg-ghost-light text-white',
  };

  const content = (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${variantStyles[variant]} ${href ? 'hover:opacity-80 cursor-pointer' : ''}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{label}</p>
      </div>
      <span
        className={`inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full text-sm font-bold tabular-nums ${countStyles[variant]}`}
      >
        {count}
      </span>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export function DashboardAlerts() {
  const [alerts, setAlerts] = useState<AlertData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [overdueRes, upcomingRes] = await Promise.all([
          fetch('/api/agent/tools/overdue-tasks'),
          fetch('/api/events/upcoming?days=7'),
        ]);

        let overdueTaskCount = 0;
        let overBudgetEventCount = 0;
        let upcomingEventCount = 0;

        if (overdueRes.ok) {
          const overdueData = await overdueRes.json();
          overdueTaskCount = overdueData.total ?? 0;
        }

        if (upcomingRes.ok) {
          const upcomingData = await upcomingRes.json();
          const events = upcomingData.events ?? [];
          upcomingEventCount = events.length;
          overBudgetEventCount = events.filter(
            (e: { actual_spent: number; budget_amount: number }) =>
              e.budget_amount > 0 && e.actual_spent > e.budget_amount
          ).length;
        }

        setAlerts({ overdueTaskCount, overBudgetEventCount, upcomingEventCount });
      } catch {
        // Silently fail -- alerts are non-critical
        setAlerts({ overdueTaskCount: 0, overBudgetEventCount: 0, upcomingEventCount: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-14 rounded-lg bg-spectral/10" />
        ))}
      </div>
    );
  }

  if (!alerts) return null;

  // Only show the section if there's something to report
  const hasAlerts = alerts.overdueTaskCount > 0 || alerts.overBudgetEventCount > 0 || alerts.upcomingEventCount > 0;
  if (!hasAlerts) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {alerts.overdueTaskCount > 0 && (
        <AlertBadge
          icon={CheckSquare}
          label="Overdue Tasks"
          count={alerts.overdueTaskCount}
          variant="danger"
        />
      )}
      {alerts.overBudgetEventCount > 0 && (
        <AlertBadge
          icon={DollarSign}
          label="Over Budget"
          count={alerts.overBudgetEventCount}
          variant="warning"
        />
      )}
      {alerts.upcomingEventCount > 0 && (
        <AlertBadge
          icon={CalendarClock}
          label="Events Next 7 Days"
          count={alerts.upcomingEventCount}
          variant="info"
        />
      )}
    </div>
  );
}
