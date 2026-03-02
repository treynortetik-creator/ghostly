'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, GripVertical, ChevronDown } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AppShell } from '@/components/layout';
import { CalendarGrid } from './CalendarGrid';
import { EventSidePanel, type CalendarEvent } from './EventSidePanel';
import { KanbanBoard, type BoardEvent, type BoardStageKey, type BoardStages } from './KanbanBoard';

type ViewMode = 'calendar' | 'board';

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

interface CalendarApiResponse {
  events: CalendarEvent[];
  task_dates: Record<string, TaskDateEntry>;
  month: string;
}

interface BoardApiResponse {
  stages: BoardStages;
  totals: Record<string, number>;
}

interface UnscheduledEvent {
  id: string;
  name: string;
  tier: string | null;
  stage: string | null;
  location: string | null;
}

// ─── Draggable Event Item (for schedule panel) ──────────────────────────────

function DraggableEventItem({ event }: { event: UnscheduledEvent }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `schedule-${event.id}`,
    data: { eventId: event.id, eventName: event.name },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-2 py-1.5 rounded bg-card/80 border border-border
        cursor-grab active:cursor-grabbing hover:border-spectral/40 transition-colors
        ${isDragging ? 'opacity-30' : ''}`}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
      <span className="text-xs text-foreground truncate">{event.name}</span>
    </div>
  );
}

// ─── Calendar Client ────────────────────────────────────────────────────────

export function PipelineClient() {
  const [view, setView] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [taskDates, setTaskDates] = useState<Record<string, TaskDateEntry>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar scheduling state
  const [unscheduledEvents, setUnscheduledEvents] = useState<UnscheduledEvent[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [draggedEvent, setDraggedEvent] = useState<{ id: string; name: string } | null>(null);

  // Board state
  const [boardStages, setBoardStages] = useState<BoardStages>({
    confirmed: [],
    in_progress: [],
    ready: [],
    active: [],
    debrief: [],
  });
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const boardFetched = useRef(false);

  // DnD sensors (shared between calendar and board contexts)
  const calendarSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchCalendarData = useCallback(async (month: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const monthStr = format(month, 'yyyy-MM');
      const res = await fetch(`/api/events/calendar?month=${monthStr}`);
      if (!res.ok) {
        throw new Error('Failed to fetch calendar data');
      }
      const data: CalendarApiResponse = await res.json();
      setEvents(data.events);
      setTaskDates(data.task_dates);
    } catch (err) {
      console.error('Calendar fetch error:', err);
      setError('Failed to load calendar data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUnscheduledEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?per_page=50&sort_by=name&sort_order=asc');
      if (!res.ok) return;
      const data = await res.json();
      const allEvents = (data.events || []) as Array<Record<string, unknown>>;
      // Filter to events without dates set
      const unscheduled = allEvents
        .filter((e) => !e.date_start)
        .map((e) => ({
          id: e.id as string,
          name: e.name as string,
          tier: (e.tier as string) ?? null,
          stage: (e.stage as string) ?? null,
          location: (e.location as string) ?? null,
        }));
      setUnscheduledEvents(unscheduled);
    } catch {
      // Silently fail — panel just won't show events
    }
  }, []);

  const fetchBoardData = useCallback(async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const res = await fetch('/api/events/board');
      if (!res.ok) {
        throw new Error('Failed to fetch board data');
      }
      const data: BoardApiResponse = await res.json();
      setBoardStages(data.stages);
      boardFetched.current = true;
    } catch (err) {
      console.error('Board fetch error:', err);
      setBoardError('Failed to load board data. Please try again.');
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'calendar') {
      fetchCalendarData(currentMonth);
      fetchUnscheduledEvents();
    } else if (view === 'board' && !boardFetched.current) {
      fetchBoardData();
    }
  }, [currentMonth, view, fetchCalendarData, fetchUnscheduledEvents, fetchBoardData]);

  // ─── Calendar drag handlers ─────────────────────────────────────────────

  const handleCalendarDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.eventId) {
      setDraggedEvent({ id: data.eventId as string, name: data.eventName as string });
    }
  }, []);

  const handleCalendarDragEnd = useCallback(async (event: DragEndEvent) => {
    setDraggedEvent(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    if (!overId.startsWith('day-')) return;

    const targetDate = overId.replace('day-', '');
    const eventId = (active.data.current?.eventId as string) ?? '';
    if (!eventId) return;

    // Remove from unscheduled list optimistically
    setUnscheduledEvents((prev) => prev.filter((e) => e.id !== eventId));

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_start: targetDate, date_end: targetDate }),
      });
      if (!res.ok) throw new Error('Failed to schedule event');
      // Refresh calendar to show the newly scheduled event
      fetchCalendarData(currentMonth);
    } catch (err) {
      console.error('Schedule error:', err);
      // Re-fetch to restore state
      fetchUnscheduledEvents();
    }
  }, [currentMonth, fetchCalendarData, fetchUnscheduledEvents]);

  // ─── Board drag handlers ────────────────────────────────────────────────

  const handleStageChange = useCallback(async (eventId: string, newStage: string) => {
    const validStages: BoardStageKey[] = ['confirmed', 'in_progress', 'ready', 'active', 'debrief'];
    if (!validStages.includes(newStage as BoardStageKey)) return;

    let prevSnapshot: BoardStages | null = null;

    // Optimistic update using functional state to avoid stale closures
    setBoardStages((prev) => {
      prevSnapshot = prev;
      let movedEvent: BoardEvent | null = null;
      const updated = {} as Record<string, BoardEvent[]>;

      for (const key of validStages) {
        const list = prev[key];
        const idx = list.findIndex((e) => e.id === eventId);
        if (idx !== -1) {
          movedEvent = { ...list[idx], stage: newStage };
          updated[key] = [...list.slice(0, idx), ...list.slice(idx + 1)];
        } else {
          updated[key] = [...list];
        }
      }

      if (!movedEvent) return prev;
      updated[newStage] = [...updated[newStage], movedEvent];
      return updated as BoardStages;
    });

    // Persist to server
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error('Failed to update event stage');
    } catch (err) {
      console.error('Stage change error:', err);
      if (prevSnapshot) setBoardStages(prevSnapshot);
    }
  }, []);

  const handlePrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const handleToday = () => setCurrentMonth(new Date());

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Calendar
          </h1>

          <div className="flex items-center gap-4">
            {/* View toggle */}
            <div className="inline-flex rounded-md overflow-hidden border border-border">
              <button
                onClick={() => setView('calendar')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === 'calendar'
                    ? 'bg-ghost-light text-spectral'
                    : 'text-muted-foreground/60 hover:bg-card'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setView('board')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-border ${
                  view === 'board'
                    ? 'bg-ghost-light text-spectral'
                    : 'text-muted-foreground/60 hover:bg-card'
                }`}
              >
                Board
              </button>
            </div>

            {/* Month navigation (only for calendar view) */}
            {view === 'calendar' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded hover:bg-card text-muted-foreground/60 hover:text-spectral transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={handleToday}
                  className="px-3 py-1 text-sm font-medium text-foreground min-w-[140px] text-center hover:text-spectral transition-colors"
                >
                  {format(currentMonth, 'MMMM yyyy')}
                </button>

                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded hover:bg-card text-muted-foreground/60 hover:text-spectral transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Refresh button (only for board view) */}
            {view === 'board' && (
              <button
                onClick={() => fetchBoardData()}
                disabled={boardLoading}
                className="p-1.5 rounded hover:bg-card text-muted-foreground/60 hover:text-spectral transition-colors disabled:opacity-50"
                aria-label="Refresh board"
              >
                <RefreshCw className={`w-4 h-4 ${boardLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {view === 'calendar' ? (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-spectral animate-spin" />
                <span className="ml-3 text-sm text-muted-foreground">Loading calendar...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <p className="text-sm text-destructive">{error}</p>
                <button
                  onClick={() => fetchCalendarData(currentMonth)}
                  className="text-sm text-spectral hover:text-foreground transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : (
              <DndContext
                sensors={calendarSensors}
                collisionDetection={closestCorners}
                onDragStart={handleCalendarDragStart}
                onDragEnd={handleCalendarDragEnd}
              >
                <div className="flex gap-4">
                  {/* Calendar */}
                  <div className="flex-1 min-w-0">
                    <CalendarGrid
                      events={events}
                      taskDates={taskDates}
                      currentMonth={currentMonth}
                      onEventClick={setSelectedEvent}
                    />
                  </div>

                  {/* Unscheduled events panel */}
                  {unscheduledEvents.length > 0 && (
                    <div className="w-48 flex-shrink-0">
                      <button
                        onClick={() => setScheduleOpen((o) => !o)}
                        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-phantom bg-ghost-dark rounded-t-lg"
                      >
                        <span>Unscheduled ({unscheduledEvents.length})</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${scheduleOpen ? '' : '-rotate-90'}`} />
                      </button>
                      {scheduleOpen && (
                        <div className="space-y-1 p-2 bg-card/50 border border-t-0 border-border rounded-b-lg max-h-[500px] overflow-y-auto">
                          {unscheduledEvents.map((ev) => (
                            <DraggableEventItem key={ev.id} event={ev} />
                          ))}
                          <p className="text-[10px] text-muted-foreground/60 text-center mt-2 px-1">
                            Drag onto a date to schedule
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drag overlay */}
                <DragOverlay dropAnimation={null}>
                  {draggedEvent && (
                    <div className="px-3 py-1.5 bg-spectral text-white text-xs rounded shadow-lg">
                      {draggedEvent.name}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </>
        ) : (
          <>
            {boardLoading && !boardFetched.current ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-spectral animate-spin" />
                <span className="ml-3 text-sm text-muted-foreground">Loading board...</span>
              </div>
            ) : boardError ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <p className="text-sm text-destructive">{boardError}</p>
                <button
                  onClick={() => fetchBoardData()}
                  className="text-sm text-spectral hover:text-foreground transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : (
              <KanbanBoard
                stages={boardStages}
                onStageChange={handleStageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Side panel */}
      {selectedEvent && (
        <EventSidePanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </AppShell>
  );
}
