'use client';

import { X, MapPin, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  tierColors,
  eventTierLabels,
  eventStageLabels,
  type EventTier,
  type EventStage,
} from '@/types/database';

export interface CalendarEvent {
  id: string;
  name: string;
  date_start: string;
  date_end: string | null;
  tier: string | null;
  stage: string | null;
  location: string | null;
  budget_amount: number;
  actual_spent: number;
  remaining: number;
  event_type_record: { id: string; name: string } | null;
  task_counts: { total: number; completed: number; overdue: number };
}

interface EventSidePanelProps {
  event: CalendarEvent;
  onClose: () => void;
}

function formatDateRange(start: string, end: string | null): string {
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, 'MMM d, yyyy');
  }
  const endDate = parseISO(end);
  // Same month
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${format(startDate, 'MMM d')}-${format(endDate, 'd, yyyy')}`;
  }
  // Different months
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
}

export function EventSidePanel({ event, onClose }: EventSidePanelProps) {
  const tierKey = event.tier as EventTier | null;
  const stageKey = event.stage as EventStage | null;
  const colors = tierKey && tierKey in tierColors ? tierColors[tierKey] : null;
  const tierLabel = tierKey && tierKey in eventTierLabels ? eventTierLabels[tierKey] : null;
  const stageLabel = stageKey && stageKey in eventStageLabels ? eventStageLabels[stageKey] : null;
  const taskPct = event.task_counts.total > 0
    ? Math.round((event.task_counts.completed / event.task_counts.total) * 100)
    : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 w-96 h-full bg-parchment border-l border-wood-dark/30 shadow-xl overflow-y-auto animate-fade-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded hover:bg-parchment-dark text-sepia/60 hover:text-sepia transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-5">
          {/* Event name */}
          <div className="pr-8">
            <h2 className="font-serif text-xl font-semibold text-wood-dark leading-tight">
              {event.name}
            </h2>
            {event.event_type_record && (
              <p className="text-sm text-sepia/70 mt-1">{event.event_type_record.name}</p>
            )}
          </div>

          {/* Date range */}
          <p className="text-sm text-ink-black">
            {formatDateRange(event.date_start, event.date_end)}
          </p>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2 text-sm text-sepia">
              <MapPin className="w-4 h-4 text-sepia/60 flex-shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {tierLabel && colors && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                {tierLabel}
              </span>
            )}
            {stageLabel && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-parchment-dark text-sepia border border-wood-medium/30">
                {stageLabel}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-wood-medium/20" />

          {/* Budget section */}
          <div>
            <h3 className="text-sm font-medium text-wood-dark mb-2">Budget</h3>
            <ProgressBar
              value={event.actual_spent}
              max={event.budget_amount || 1}
              size="md"
            />
            <p className="text-xs text-sepia mt-1.5 tabular-nums">
              ${event.actual_spent.toLocaleString('en-US', { minimumFractionDigits: 2 })} spent of ${event.budget_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-sepia/70 tabular-nums">
              ${Math.abs(event.remaining).toLocaleString('en-US', { minimumFractionDigits: 2 })} {event.remaining >= 0 ? 'remaining' : 'over budget'}
            </p>
          </div>

          {/* Task completion */}
          <div>
            <h3 className="text-sm font-medium text-wood-dark mb-2">Tasks</h3>
            <ProgressBar
              value={event.task_counts.completed}
              max={event.task_counts.total || 1}
              size="md"
              colorOverride="green"
            />
            <p className="text-xs text-sepia mt-1.5">
              {event.task_counts.completed}/{event.task_counts.total} tasks complete ({taskPct}%)
            </p>
            {event.task_counts.overdue > 0 && (
              <p className="text-xs text-ink-red mt-0.5">
                {event.task_counts.overdue} overdue
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-wood-medium/20" />

          {/* Link to full details */}
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-gold hover:text-wood-dark transition-colors"
          >
            View Full Details
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </>
  );
}
