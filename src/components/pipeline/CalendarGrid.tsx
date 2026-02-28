'use client';

import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  isSameDay,
  parseISO,
  isBefore,
  isAfter,
  format,
} from 'date-fns';
import { EventBar } from './EventBar';
import { TaskMarker } from './TaskMarker';
import { TaskPopover } from './TaskPopover';
import type { CalendarEvent } from './EventSidePanel';

interface TaskDateEntry {
  count: number;
  tasks: Array<{
    id: string;
    title: string;
    event_name: string;
    event_id: string;
    due_date: string;
    completed: boolean;
  }>;
}

interface CalendarGridProps {
  events: CalendarEvent[];
  taskDates: Record<string, TaskDateEntry>;
  currentMonth: Date;
  onEventClick: (event: CalendarEvent) => void;
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_BARS = 3;

interface BarSegment {
  eventId: string;
  event: CalendarEvent;
  startCol: number;
  endCol: number;
  slotIndex: number;
  isStart: boolean;
  isEnd: boolean;
}

/**
 * For a given week (array of 7 dates), compute which event bars
 * are visible and their column positions + vertical slot assignments.
 */
function computeWeekBars(
  weekDates: Date[],
  events: CalendarEvent[],
): BarSegment[] {
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  // Find events that overlap this week
  const overlapping: Array<{
    event: CalendarEvent;
    eventStart: Date;
    eventEnd: Date;
    startCol: number;
    endCol: number;
    isStart: boolean;
    isEnd: boolean;
  }> = [];

  for (const ev of events) {
    if (!ev.date_start) continue;
    const evStart = parseISO(ev.date_start);
    const evEnd = ev.date_end ? parseISO(ev.date_end) : evStart;

    // Check overlap: event ends >= weekStart AND event starts <= weekEnd
    if (isBefore(evEnd, weekStart) || isAfter(evStart, weekEnd)) continue;

    // Clamp to week boundaries
    const clampedStart = isBefore(evStart, weekStart) ? weekStart : evStart;
    const clampedEnd = isAfter(evEnd, weekEnd) ? weekEnd : evEnd;

    // Find column indices
    let startCol = 0;
    let endCol = 6;
    for (let i = 0; i < 7; i++) {
      if (isSameDay(weekDates[i], clampedStart)) startCol = i;
      if (isSameDay(weekDates[i], clampedEnd)) endCol = i;
    }

    overlapping.push({
      event: ev,
      eventStart: evStart,
      eventEnd: evEnd,
      startCol,
      endCol,
      isStart: !isBefore(evStart, weekStart), // event actually starts in this week
      isEnd: !isAfter(evEnd, weekEnd), // event actually ends in this week
    });
  }

  // Sort by start date then by span length (longer first) for stable slot assignment
  overlapping.sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    const spanA = a.endCol - a.startCol;
    const spanB = b.endCol - b.startCol;
    return spanB - spanA; // longer bars first
  });

  // Assign slots (vertical positions) greedily
  // slots[i] = set of columns occupied in slot i
  const slots: Set<number>[] = [];

  const segments: BarSegment[] = [];

  for (const item of overlapping) {
    const cols = new Set<number>();
    for (let c = item.startCol; c <= item.endCol; c++) cols.add(c);

    // Find first slot where none of these columns are occupied
    let assignedSlot = -1;
    for (let s = 0; s < slots.length; s++) {
      let conflict = false;
      for (const c of cols) {
        if (slots[s].has(c)) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        assignedSlot = s;
        break;
      }
    }

    if (assignedSlot === -1) {
      assignedSlot = slots.length;
      slots.push(new Set());
    }

    // Mark columns as occupied in this slot
    for (const c of cols) {
      slots[assignedSlot].add(c);
    }

    segments.push({
      eventId: item.event.id,
      event: item.event,
      startCol: item.startCol,
      endCol: item.endCol,
      slotIndex: assignedSlot,
      isStart: item.isStart,
      isEnd: item.isEnd,
    });
  }

  return segments;
}

export function CalendarGrid({
  events,
  taskDates,
  currentMonth,
  onEventClick,
}: CalendarGridProps) {
  const [popoverDate, setPopoverDate] = useState<string | null>(null);

  // Generate all dates for the calendar grid
  const { weekRows } = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const dates: Date[] = [];
    let d = calStart;
    while (!isAfter(d, calEnd)) {
      dates.push(d);
      d = addDays(d, 1);
    }

    // Chunk into weeks
    const weeks: Date[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
      weeks.push(dates.slice(i, i + 7));
    }

    return { weekRows: weeks, allDates: dates };
  }, [currentMonth]);

  // Precompute bars for each week
  const weekBars = useMemo(() => {
    return weekRows.map((week) => computeWeekBars(week, events));
  }, [weekRows, events]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* Day headers */}
      <div className="grid grid-cols-7">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground/60 bg-card border-b border-border"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weekRows.map((week, weekIdx) => {
        const bars = weekBars[weekIdx];
        const visibleBars = bars.filter((b) => b.slotIndex < MAX_VISIBLE_BARS);
        const hiddenCount = bars.length - visibleBars.length;
        // Calculate how many slots we need for bar area height
        const maxSlot = visibleBars.length > 0
          ? Math.max(...visibleBars.map((b) => b.slotIndex))
          : -1;
        const barAreaHeight = (maxSlot + 1) * 26;

        return (
          <div key={weekIdx} className="grid grid-cols-7 relative" style={{ minHeight: '120px' }}>
            {/* Day cells */}
            {week.map((date, dayIdx) => {
              const inMonth = isSameMonth(date, currentMonth);
              const today = isToday(date);
              const dateKey = format(date, 'yyyy-MM-dd');
              const taskEntry = taskDates[dateKey];

              return (
                <div
                  key={dayIdx}
                  className={`border-r border-b border-border p-1 relative ${
                    !inMonth ? 'bg-card/50' : ''
                  } ${today ? 'ring-2 ring-spectral/50 ring-inset' : ''}`}
                >
                  <span
                    className={`text-xs font-medium ${
                      !inMonth ? 'text-muted-foreground/60' : today ? 'text-spectral font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {/* Task marker */}
                  {taskEntry && taskEntry.count > 0 && (
                    <>
                      <TaskMarker
                        count={taskEntry.count}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPopoverDate(popoverDate === dateKey ? null : dateKey);
                        }}
                      />
                      {popoverDate === dateKey && (
                        <TaskPopover
                          tasks={taskEntry.tasks}
                          onClose={() => setPopoverDate(null)}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Event bars overlay */}
            <div
              className="absolute inset-x-0 pointer-events-none"
              style={{ top: '24px', height: `${Math.max(barAreaHeight, 0)}px` }}
            >
              {visibleBars.map((bar) => (
                <EventBar
                  key={`${bar.eventId}-${weekIdx}`}
                  id={bar.eventId}
                  name={bar.event.name}
                  tier={bar.event.tier}
                  startCol={bar.startCol}
                  endCol={bar.endCol}
                  slotIndex={bar.slotIndex}
                  isStart={bar.isStart}
                  isEnd={bar.isEnd}
                  onClick={() => onEventClick(bar.event)}
                />
              ))}
            </div>

            {/* Overflow indicator */}
            {hiddenCount > 0 && (
              <div className="absolute bottom-1 left-1 text-[10px] text-muted-foreground/60 pointer-events-none">
                +{hiddenCount} more
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
