'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { AppShell } from '@/components/layout';
import { CalendarGrid } from './CalendarGrid';
import { EventSidePanel, type CalendarEvent } from './EventSidePanel';
import { KanbanBoard, type BoardEvent, type BoardStages } from './KanbanBoard';

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

export function PipelineClient() {
  const [view, setView] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [taskDates, setTaskDates] = useState<Record<string, TaskDateEntry>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } else if (view === 'board' && !boardFetched.current) {
      fetchBoardData();
    }
  }, [currentMonth, view, fetchCalendarData, fetchBoardData]);

  const handleStageChange = useCallback(async (eventId: string, newStage: string) => {
    // Optimistic update: move the card locally
    const prevStages = { ...boardStages };
    let movedEvent: BoardEvent | null = null;

    // Find and remove from current stage
    const updatedStages = { ...boardStages } as Record<string, BoardEvent[]>;
    for (const stageKey of Object.keys(updatedStages)) {
      const idx = updatedStages[stageKey].findIndex((e) => e.id === eventId);
      if (idx !== -1) {
        movedEvent = { ...updatedStages[stageKey][idx], stage: newStage };
        updatedStages[stageKey] = [
          ...updatedStages[stageKey].slice(0, idx),
          ...updatedStages[stageKey].slice(idx + 1),
        ];
        break;
      }
    }

    if (!movedEvent) return;

    // Add to new stage
    updatedStages[newStage] = [...(updatedStages[newStage] || []), movedEvent];
    setBoardStages(updatedStages as BoardStages);

    // Persist to server
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) {
        throw new Error('Failed to update event stage');
      }
    } catch (err) {
      console.error('Stage change error:', err);
      // Revert on failure
      setBoardStages(prevStages);
    }
  }, [boardStages]);

  const handlePrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const handleToday = () => setCurrentMonth(new Date());

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="font-serif text-2xl font-semibold text-wood-dark tracking-tight">
            The Pipeline
          </h1>

          <div className="flex items-center gap-4">
            {/* View toggle */}
            <div className="inline-flex rounded-md overflow-hidden border border-wood-medium/30">
              <button
                onClick={() => setView('calendar')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === 'calendar'
                    ? 'bg-wood-medium text-ink-gold'
                    : 'text-sepia/70 hover:bg-parchment-dark'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setView('board')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-wood-medium/30 ${
                  view === 'board'
                    ? 'bg-wood-medium text-ink-gold'
                    : 'text-sepia/70 hover:bg-parchment-dark'
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
                  className="p-1.5 rounded hover:bg-parchment-dark text-sepia/70 hover:text-ink-gold transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={handleToday}
                  className="px-3 py-1 text-sm font-serif font-medium text-wood-dark min-w-[140px] text-center hover:text-ink-gold transition-colors"
                >
                  {format(currentMonth, 'MMMM yyyy')}
                </button>

                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded hover:bg-parchment-dark text-sepia/70 hover:text-ink-gold transition-colors"
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
                className="p-1.5 rounded hover:bg-parchment-dark text-sepia/70 hover:text-ink-gold transition-colors disabled:opacity-50"
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
                <Loader2 className="w-6 h-6 text-ink-gold animate-spin" />
                <span className="ml-3 text-sm text-sepia">Loading calendar...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <p className="text-sm text-ink-red">{error}</p>
                <button
                  onClick={() => fetchCalendarData(currentMonth)}
                  className="text-sm text-ink-gold hover:text-wood-dark transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : (
              <CalendarGrid
                events={events}
                taskDates={taskDates}
                currentMonth={currentMonth}
                onEventClick={setSelectedEvent}
              />
            )}
          </>
        ) : (
          <>
            {boardLoading && !boardFetched.current ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-ink-gold animate-spin" />
                <span className="ml-3 text-sm text-sepia">Loading board...</span>
              </div>
            ) : boardError ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <p className="text-sm text-ink-red">{boardError}</p>
                <button
                  onClick={() => fetchBoardData()}
                  className="text-sm text-ink-gold hover:text-wood-dark transition-colors"
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
