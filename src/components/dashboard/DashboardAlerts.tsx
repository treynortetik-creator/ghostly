'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarClock, DollarSign, CheckSquare, ChevronDown, ExternalLink } from 'lucide-react';

/* ============================================
   DASHBOARD ALERTS
   ============================================
   Quick-stats alert bar showing:
   - Overdue checklist items
   - Over-budget events
   - Events in the next 7 days
   Clicking an alert expands a dropdown panel
   with links to the relevant items.
   ============================================ */

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  event_id: string;
  event_name: string | null;
}

interface UpcomingEvent {
  id: string;
  name: string;
  date_start: string;
  budget_amount: number;
  actual_spent: number;
}

interface AlertData {
  overdueTaskCount: number;
  overBudgetEventCount: number;
  upcomingEventCount: number;
  overdueTasks: OverdueTask[];
  upcomingEvents: UpcomingEvent[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function AlertBadge({
  icon: Icon,
  label,
  count,
  variant,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  variant: 'danger' | 'warning' | 'info';
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const variantStyles = {
    danger: 'bg-destructive/10 text-destructive border-destructive/20',
    warning: 'bg-spectral/10 text-spectral border-spectral/20',
    info: 'bg-ether/10 text-ether border-ether/20',
  };

  const countStyles = {
    danger: 'bg-destructive text-white',
    warning: 'bg-spectral text-white',
    info: 'bg-ether text-white',
  };

  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${variantStyles[variant]} hover:opacity-80 cursor-pointer`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium truncate">{label}</p>
        </div>
        <span
          className={`inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full text-sm font-bold tabular-nums ${countStyles[variant]}`}
        >
          {count}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && children && (
        <div
          ref={panelRef}
          className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg max-h-64 overflow-y-auto"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DashboardAlerts() {
  const [alerts, setAlerts] = useState<AlertData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpandedPanel(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        let overdueTasks: OverdueTask[] = [];
        let upcomingEvents: UpcomingEvent[] = [];

        if (overdueRes.ok) {
          const overdueData = await overdueRes.json();
          overdueTaskCount = overdueData.total ?? 0;
          overdueTasks = overdueData.overdue_tasks ?? [];
        }

        if (upcomingRes.ok) {
          const upcomingData = await upcomingRes.json();
          const events = upcomingData.events ?? [];
          upcomingEvents = events;
          upcomingEventCount = events.length;
          overBudgetEventCount = events.filter(
            (e: { actual_spent: number; budget_amount: number }) =>
              e.budget_amount > 0 && e.actual_spent > e.budget_amount
          ).length;
        }

        setAlerts({ overdueTaskCount, overBudgetEventCount, upcomingEventCount, overdueTasks, upcomingEvents });
      } catch {
        setAlerts({ overdueTaskCount: 0, overBudgetEventCount: 0, upcomingEventCount: 0, overdueTasks: [], upcomingEvents: [] });
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

  const hasAlerts = alerts.overdueTaskCount > 0 || alerts.overBudgetEventCount > 0 || alerts.upcomingEventCount > 0;
  if (!hasAlerts) return null;

  const toggle = (panel: string) => setExpandedPanel(prev => prev === panel ? null : panel);

  return (
    <div ref={containerRef} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {alerts.overdueTaskCount > 0 && (
        <AlertBadge
          icon={CheckSquare}
          label="Overdue Tasks"
          count={alerts.overdueTaskCount}
          variant="danger"
          expanded={expandedPanel === 'overdue'}
          onToggle={() => toggle('overdue')}
        >
          <div className="py-1">
            {alerts.overdueTasks.slice(0, 10).map(task => (
              <Link
                key={task.id}
                href={`/events/${task.event_id}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors"
                onClick={() => setExpandedPanel(null)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.event_name} &middot; Due {formatDate(task.due_date)}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {alerts.overdueTasks.length > 10 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                + {alerts.overdueTasks.length - 10} more
              </p>
            )}
          </div>
        </AlertBadge>
      )}
      {alerts.overBudgetEventCount > 0 && (
        <AlertBadge
          icon={DollarSign}
          label="Over Budget"
          count={alerts.overBudgetEventCount}
          variant="warning"
          expanded={expandedPanel === 'budget'}
          onToggle={() => toggle('budget')}
        >
          <div className="py-1">
            {alerts.upcomingEvents
              .filter(e => e.budget_amount > 0 && e.actual_spent > e.budget_amount)
              .map(event => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors"
                  onClick={() => setExpandedPanel(null)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${event.actual_spent.toLocaleString()} / ${event.budget_amount.toLocaleString()}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
          </div>
        </AlertBadge>
      )}
      {alerts.upcomingEventCount > 0 && (
        <AlertBadge
          icon={CalendarClock}
          label="Events Next 7 Days"
          count={alerts.upcomingEventCount}
          variant="info"
          expanded={expandedPanel === 'upcoming'}
          onToggle={() => toggle('upcoming')}
        >
          <div className="py-1">
            {alerts.upcomingEvents.map(event => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors"
                onClick={() => setExpandedPanel(null)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{event.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(event.date_start)}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </AlertBadge>
      )}
    </div>
  );
}
