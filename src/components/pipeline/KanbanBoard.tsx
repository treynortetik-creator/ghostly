'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { eventStageLabels } from '@/types/database';

export type BoardStageKey = 'confirmed' | 'in_progress' | 'ready' | 'active' | 'debrief';

export interface BoardEvent {
  id: string;
  name: string;
  date_start: string | null;
  date_end: string | null;
  location: string | null;
  tier: string | null;
  stage: string | null;
  budget_amount: number;
  actual_spent: number;
  remaining: number;
  shipping_handler: string | null;
  event_type_record: { id: string; name: string } | null;
  task_counts: { total: number; completed: number };
  days_until: number | null;
}

export type BoardStages = {
  confirmed: BoardEvent[];
  in_progress: BoardEvent[];
  ready: BoardEvent[];
  active: BoardEvent[];
  debrief: BoardEvent[];
};

interface KanbanBoardProps {
  stages: BoardStages;
  onStageChange: (eventId: string, newStage: string) => Promise<void>;
}

const STAGE_ORDER: BoardStageKey[] = ['confirmed', 'in_progress', 'ready', 'active', 'debrief'];

export function KanbanBoard({ stages, onStageChange }: KanbanBoardProps) {
  const [activeEvent, setActiveEvent] = useState<BoardEvent | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const draggedEvent = event.active.data.current?.event as BoardEvent | undefined;
    if (draggedEvent) {
      setActiveEvent(draggedEvent);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveEvent(null);

      const { active, over } = event;
      if (!over) return;

      const eventId = active.id as string;

      // Find the current stage of the dragged event
      const draggedEvent = active.data.current?.event as BoardEvent | undefined;
      if (!draggedEvent) return;

      const currentStage = draggedEvent.stage as BoardStageKey | null;
      if (!currentStage || !STAGE_ORDER.includes(currentStage)) return;

      // Dropping over a card can return that card id; resolve to the card's stage.
      let newStage = over.id as string;
      if (!STAGE_ORDER.includes(newStage as BoardStageKey)) {
        const overCardId = String(over.id);
        const overCardStage = STAGE_ORDER.find((stageKey) =>
          (stages[stageKey] || []).some((stageEvent) => stageEvent.id === overCardId)
        );
        if (overCardStage) {
          newStage = overCardStage;
        } else {
          const overDataStage = over.data.current?.stageKey;
          if (typeof overDataStage === 'string') {
            newStage = overDataStage;
          }
        }
      }

      if (!STAGE_ORDER.includes(newStage as BoardStageKey)) return;
      if (currentStage === newStage) return;

      await onStageChange(eventId, newStage);
    },
    [onStageChange, stages]
  );

  const handleDragCancel = useCallback(() => {
    setActiveEvent(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {STAGE_ORDER.map((stageKey) => (
          <KanbanColumn
            key={stageKey}
            stageKey={stageKey}
            stageLabel={eventStageLabels[stageKey]}
            events={stages[stageKey] || []}
          />
        ))}
      </div>

      {/* Drag overlay - ghost card that follows the cursor */}
      <DragOverlay dropAnimation={null}>
        {activeEvent ? (
          <div className="w-[264px]">
            <KanbanCard event={activeEvent} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
