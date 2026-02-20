'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDateLong } from '@/lib/format';
import type { EventReminder, ReminderStatus } from '@/types/database';

/* ============================================
   EVENT REMINDERS TAB
   ============================================
   Shows event reminders timeline with status
   badges, generation, and dismiss functionality.
   ============================================ */

interface EventRemindersTabProps {
  eventId: string;
  eventDateStart: string | null;
}

const statusConfig: Record<ReminderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-ink-gold/15 text-ink-gold border-ink-gold/30' },
  sent: { label: 'Sent', className: 'bg-ink-green/15 text-ink-green border-ink-green/30' },
  dismissed: { label: 'Dismissed', className: 'bg-wood-medium/15 text-sepia border-wood-medium/30' },
  snoozed: { label: 'Snoozed', className: 'bg-sepia/15 text-sepia border-sepia/30' },
};

function getStatusClasses(reminder: EventReminder): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reminderDate = new Date(reminder.reminder_date);
  reminderDate.setHours(0, 0, 0, 0);

  if (reminder.status === 'pending' && reminderDate < today) {
    return 'bg-ink-red/15 text-ink-red border-ink-red/30';
  }
  return statusConfig[reminder.status]?.className || statusConfig.pending.className;
}

function getStatusLabel(reminder: EventReminder): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reminderDate = new Date(reminder.reminder_date);
  reminderDate.setHours(0, 0, 0, 0);

  if (reminder.status === 'pending' && reminderDate < today) {
    return 'Past Due';
  }
  return statusConfig[reminder.status]?.label || 'Pending';
}

export function EventRemindersTab({ eventId, eventDateStart }: EventRemindersTabProps) {
  const [reminders, setReminders] = useState<EventReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const { toasts, removeToast, toast } = useToast();

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/reminders`);
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setShowGenerateConfirm(false);
    try {
      const res = await fetch(`/api/events/${eventId}/reminders/generate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate reminders');
      }
      await fetchReminders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate reminders');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDismiss = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/reminders/${reminderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to dismiss reminder');
      }
      await fetchReminders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss reminder');
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-sepia">Loading reminders...</div>;
  }

  const sortedReminders = [...reminders].sort(
    (a, b) => new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime()
  );

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Generate Reminders Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-ink-gold" />
          <span className="text-sm text-sepia">
            {reminders.length} reminder{reminders.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchReminders}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {!eventDateStart ? (
            <div className="relative group">
              <Button
                variant="gold"
                size="sm"
                disabled
                leftIcon={<Bell className="w-4 h-4" />}
              >
                Generate Reminders
              </Button>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-wood-dark text-parchment text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Set event start date first
              </div>
            </div>
          ) : (
            <Button
              variant="gold"
              size="sm"
              onClick={() => setShowGenerateConfirm(true)}
              isLoading={isGenerating}
              leftIcon={<Bell className="w-4 h-4" />}
            >
              Generate Reminders
            </Button>
          )}
        </div>
      </div>

      {/* Generate Confirmation */}
      {showGenerateConfirm && (
        <Card className="bg-ink-gold/5 border-ink-gold/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-ink-gold" />
                <div>
                  <p className="font-medium text-ink-black">
                    Generate reminders from cadence template?
                  </p>
                  <p className="text-sm text-sepia">
                    This will replace any existing reminders for this event.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowGenerateConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleGenerate}
                  isLoading={isGenerating}
                >
                  Generate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reminders List */}
      {sortedReminders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Bell className="w-10 h-10 text-sepia/30 mx-auto mb-3" />
              <p className="text-sepia">No reminders generated yet.</p>
              <p className="text-sm text-sepia/70 mt-1">
                Click &ldquo;Generate Reminders&rdquo; to create a reminder schedule from a cadence template.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedReminders.map(reminder => (
            <div
              key={reminder.id}
              className="flex items-center justify-between p-4 rounded-lg bg-parchment border border-wood-medium/20 hover:border-wood-medium/40 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="text-right min-w-[130px]">
                  <p className="text-sm font-medium tabular-nums text-ink-black">
                    {formatDateLong(reminder.reminder_date)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-black truncate">{reminder.title}</p>
                  {reminder.description && (
                    <p className="text-sm text-sepia truncate">{reminder.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getStatusClasses(reminder)}`}>
                  {getStatusLabel(reminder)}
                </span>
                {reminder.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(reminder.id)}
                  >
                    Dismiss
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
