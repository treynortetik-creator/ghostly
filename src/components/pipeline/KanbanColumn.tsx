'use client';

import { useDroppable } from '@dnd-kit/core';
import { KanbanCard } from './KanbanCard';
import type { BoardEvent } from './KanbanBoard';

interface KanbanColumnProps {
  stageKey: string;
  stageLabel: string;
  events: BoardEvent[];
}

export function KanbanColumn({ stageKey, stageLabel, events }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageKey,
    data: {
      stageKey,
      type: 'column',
    },
  });

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 bg-ghost-dark rounded-t-lg">
        <h3 className="text-sm font-semibold text-phantom tracking-wide">
          {stageLabel}
        </h3>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-medium rounded-full bg-spectral/10 text-phantom">
          {events.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 min-h-[200px] p-2 space-y-2 overflow-y-auto
          bg-card/50 border border-t-0 border-border rounded-b-lg
          transition-colors duration-200
          ${isOver ? 'bg-spectral/10 border-spectral ring-1 ring-spectral/30' : ''}
        `}
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60 italic">
            No events
          </div>
        ) : (
          events.map((event) => (
            <KanbanCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
