'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MapPin, Calendar, GripVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  tierColors,
  eventTierLabels,
  type EventTier,
} from '@/types/database';
import { formatCurrencyCompact, formatDateMedium, formatDateShort } from '@/lib/format';
import type { BoardEvent } from './KanbanBoard';

interface KanbanCardProps {
  event: BoardEvent;
  overlay?: boolean;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBD';
  if (!end || end === start) {
    return formatDateMedium(start);
  }
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${formatDateShort(start)}-${endDate.getDate()}, ${endDate.getFullYear()}`;
  }
  return `${formatDateShort(start)} - ${formatDateMedium(end)}`;
}

function CountdownBadge({ daysUntil }: { daysUntil: number | null }) {
  if (daysUntil === null) return null;

  let text: string;
  let colorClass: string;

  if (daysUntil > 7) {
    text = `in ${daysUntil} days`;
    colorClass = 'text-ink-green';
  } else if (daysUntil > 0) {
    text = `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    colorClass = 'text-ink-gold';
  } else if (daysUntil === 0) {
    text = 'TODAY';
    colorClass = 'text-ink-gold font-bold';
  } else {
    const abs = Math.abs(daysUntil);
    text = `${abs} day${abs === 1 ? '' : 's'} ago`;
    colorClass = 'text-ink-red';
  }

  return <span className={`text-[10px] font-medium ${colorClass}`}>{text}</span>;
}

export function KanbanCard({ event, overlay = false }: KanbanCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const tierKey = event.tier as EventTier | null;
  const colors = tierKey && tierKey in tierColors ? tierColors[tierKey] : null;
  const tierLabel = tierKey && tierKey in eventTierLabels ? eventTierLabels[tierKey] : null;

  const taskPct = event.task_counts.total > 0
    ? Math.round((event.task_counts.completed / event.task_counts.total) * 100)
    : 0;

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if we're dragging
    if (isDragging) return;
    // Don't navigate if clicking the grip handle
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) return;
    router.push(`/events/${event.id}`);
  };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`
        group bg-parchment rounded-lg border border-wood-medium/30 shadow-sm
        cursor-pointer hover:shadow-md hover:border-ink-gold/40 transition-all duration-150
        ${isDragging ? 'opacity-30' : ''}
        ${overlay ? 'shadow-lg border-ink-gold/50 rotate-1 scale-105' : ''}
      `}
      onClick={handleClick}
    >
      <div className="p-3 space-y-2">
        {/* Header: grip + name + countdown */}
        <div className="flex items-start gap-1.5">
          <button
            {...(overlay ? {} : { ...listeners, ...attributes })}
            data-drag-handle
            className="mt-0.5 p-0.5 rounded text-sepia/30 hover:text-sepia/60 cursor-grab active:cursor-grabbing flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <h4 className="font-serif text-sm font-semibold text-wood-dark leading-tight truncate">
              {event.name}
            </h4>
            {event.event_type_record && (
              <p className="text-[10px] text-sepia/60 truncate">{event.event_type_record.name}</p>
            )}
          </div>
          <CountdownBadge daysUntil={event.days_until} />
        </div>

        {/* Date + location */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-[11px] text-sepia/80">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{formatDateRange(event.date_start, event.date_end)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-1 text-[11px] text-sepia/70">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
        </div>

        {/* Tier badge */}
        {tierLabel && colors && (
          <div>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
              {tierLabel}
            </span>
          </div>
        )}

        {/* Budget bar */}
        <div className="space-y-0.5">
          <ProgressBar
            value={event.actual_spent}
            max={event.budget_amount || 1}
            size="sm"
          />
          <p className="text-[10px] text-sepia tabular-nums">
            {formatCurrencyCompact(event.actual_spent)} / {formatCurrencyCompact(event.budget_amount)}
          </p>
        </div>

        {/* Tasks */}
        {event.task_counts.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ProgressBar
                value={event.task_counts.completed}
                max={event.task_counts.total}
                size="sm"
                colorOverride="green"
              />
            </div>
            <span className="text-[10px] text-sepia tabular-nums whitespace-nowrap">
              {event.task_counts.completed}/{event.task_counts.total} ({taskPct}%)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
