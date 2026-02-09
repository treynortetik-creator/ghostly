'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import type { EventReminderWithEvent } from '@/types/database';

/* ============================================
   UPCOMING REMINDERS WIDGET
   ============================================
   Dashboard widget showing next 14 days of
   reminders with links to event detail pages.
   ============================================ */

interface UpcomingRemindersResponse {
  reminders: EventReminderWithEvent[];
  meta: { total: number; date_range: { from: string; to: string; days: number } };
}

function formatReminderDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getDaysUntilLabel(dateStr: string): { label: string; urgency: 'overdue' | 'today' | 'upcoming' } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgency: 'overdue' };
  if (diffDays === 0) return { label: 'Today', urgency: 'today' };
  if (diffDays === 1) return { label: 'Tomorrow', urgency: 'upcoming' };
  return { label: `In ${diffDays} days`, urgency: 'upcoming' };
}

const urgencyColors = {
  overdue: 'text-ink-red',
  today: 'text-ink-gold',
  upcoming: 'text-sepia',
};

export function UpcomingReminders() {
  const [reminders, setReminders] = useState<EventReminderWithEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const res = await fetch('/api/reminders/upcoming?days=14');
        if (res.ok) {
          const data: UpcomingRemindersResponse = await res.json();
          setReminders(data.reminders || []);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchReminders();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-ink-gold/10 text-ink-gold">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Upcoming Reminders</CardTitle>
            <CardDescription>Next 14 days</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center justify-between p-3 rounded-lg bg-wood-medium/5">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-wood-medium/15 rounded" />
                  <div className="h-3 w-28 bg-wood-medium/10 rounded" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-4 w-20 bg-wood-medium/15 rounded ml-auto" />
                  <div className="h-3 w-16 bg-wood-medium/10 rounded ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-6">
            <Bell className="w-8 h-8 text-sepia/30 mx-auto mb-2" />
            <p className="text-sm text-sepia">No upcoming reminders in the next 14 days.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reminders.slice(0, 10).map(reminder => {
              const { label, urgency } = getDaysUntilLabel(reminder.reminder_date);
              return (
                <Link key={reminder.id} href={`/events/${reminder.event_id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-black truncate">{reminder.title}</p>
                      <p className="text-sm text-sepia truncate">{reminder.event_name}</p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-sm font-medium tabular-nums text-ink-black">
                        {formatReminderDate(reminder.reminder_date)}
                      </p>
                      <p className={`text-xs ${urgencyColors[urgency]}`}>{label}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
