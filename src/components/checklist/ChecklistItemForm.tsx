'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ChecklistPhase, TeamMember } from '@/types/database';

interface ChecklistItemFormProps {
  teamMembers: TeamMember[];
  onSave: (data: {
    title: string;
    description: string;
    phase: ChecklistPhase;
    assignee_id: string;
    due_date: string;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ChecklistItemForm({ teamMembers, onSave, onCancel, isLoading }: ChecklistItemFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<ChecklistPhase>('pre_event');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title, description, phase, assignee_id: assigneeId, due_date: dueDate });
  };

  return (
    <div className="fixed inset-0 bg-ink-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-parchment rounded-lg border border-wood-medium/40 parchment-shadow w-full max-w-lg">
        <div className="px-6 py-4 border-b border-wood-medium/20 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-wood-dark">Add Task</h2>
          <button onClick={onCancel} className="text-sepia hover:text-wood-dark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-wood-dark mb-1">
              Task <span className="text-ink-red">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
              placeholder="Task description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-wood-dark mb-1">Details</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent resize-none"
              placeholder="Additional details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-wood-dark mb-1">Phase</label>
              <select
                value={phase}
                onChange={e => setPhase(e.target.value as ChecklistPhase)}
                className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
              >
                <option value="pre_event">Before the Affair</option>
                <option value="day_of">The Day Itself</option>
                <option value="post_event">After the Affair</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-wood-dark mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-wood-dark mb-1">Assignee</label>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
            >
              <option value="">Unassigned</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onCancel} type="button">Cancel</Button>
            <Button type="submit" isLoading={isLoading}>Add Task</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
