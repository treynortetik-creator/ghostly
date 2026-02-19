'use client';

import { useEffect, useRef } from 'react';

interface TaskItem {
  id: string;
  title: string;
  event_name: string;
  event_id: string;
  due_date: string;
  completed: boolean;
}

interface TaskPopoverProps {
  tasks: TaskItem[];
  onClose: () => void;
}

export function TaskPopover({ tasks, onClose }: TaskPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-6 right-0 z-50 w-64 bg-parchment border border-wood-medium/40 rounded-lg shadow-lg overflow-hidden animate-fade-in"
    >
      <div className="px-3 py-2 border-b border-wood-medium/20 bg-parchment-dark">
        <span className="text-xs font-medium text-sepia">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} due
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="px-3 py-2 border-b border-wood-medium/10 last:border-b-0 hover:bg-parchment-dark/50"
          >
            <div className="flex items-start gap-2">
              <span
                className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  task.completed ? 'bg-ink-green' : 'bg-wood-medium/40'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${task.completed ? 'line-through text-sepia/60' : 'text-ink-black'}`}>
                  {task.title}
                </p>
                <p className="text-[10px] text-sepia/70 truncate mt-0.5">
                  {task.event_name}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
