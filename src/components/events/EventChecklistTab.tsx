'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, ListChecks, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChecklistSection } from '@/components/checklist/ChecklistSection';
import { ChecklistItemForm } from '@/components/checklist/ChecklistItemForm';
import { ApplyTemplateModal } from '@/components/checklist/ApplyTemplateModal';
import type { EventChecklistItem, TeamMember, ChecklistPhase } from '@/types/database';

interface ChecklistData {
  items: (EventChecklistItem & { assignee?: TeamMember | null })[];
  grouped: Record<ChecklistPhase, (EventChecklistItem & { assignee?: TeamMember | null })[]>;
  total: number;
  completed: number;
}

interface EventChecklistTabProps {
  eventId: string;
}

export function EventChecklistTab({ eventId }: EventChecklistTabProps) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const fetchChecklist = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/checklist`);
      const json = await res.json();
      setData(json);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  const fetchTeamMembers = useCallback(async () => {
    const res = await fetch('/api/team');
    const json = await res.json();
    setTeamMembers(json.team_members || []);
  }, []);

  useEffect(() => {
    fetchChecklist();
    fetchTeamMembers();
  }, [fetchChecklist, fetchTeamMembers]);

  const handleToggle = async (itemId: string, completed: boolean) => {
    await fetch(`/api/events/${eventId}/checklist/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    fetchChecklist();
  };

  const handleAddItem = async (formData: {
    title: string;
    description: string;
    phase: ChecklistPhase;
    assignee_id: string;
    due_date: string;
  }) => {
    setIsAdding(true);
    try {
      const res = await fetch(`/api/events/${eventId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowAddForm(false);
        fetchChecklist();
      }
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-sepia">Loading checklist...</div>;
  }

  const total = data?.total || 0;
  const completed = data?.completed || 0;
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-lg font-semibold text-wood-dark">
            Task Ledger
          </h3>
          {total > 0 && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
              completed === total
                ? 'bg-ink-green/20 text-ink-green'
                : 'bg-wood-medium/10 text-sepia'
            }`}>
              {completed}/{total}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileText className="w-4 h-4" />}
            onClick={() => setShowTemplateModal(true)}
          >
            Apply Template
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddForm(true)}
          >
            Add Task
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <ProgressBar value={progressPercent} max={100} />
      )}

      {/* Checklist sections */}
      {total === 0 ? (
        <div className="text-center py-8 text-sepia">
          <ListChecks className="w-10 h-10 mx-auto mb-3 text-sepia/30" />
          <p className="font-serif">No tasks on the ledger</p>
          <p className="text-sm mt-1">Apply a template or add individual tasks to begin.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(['pre_event', 'day_of', 'post_event'] as ChecklistPhase[]).map(phase => (
            <ChecklistSection
              key={phase}
              phase={phase}
              items={data?.grouped[phase] || []}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddForm && (
        <ChecklistItemForm
          teamMembers={teamMembers}
          onSave={handleAddItem}
          onCancel={() => setShowAddForm(false)}
          isLoading={isAdding}
        />
      )}

      {showTemplateModal && (
        <ApplyTemplateModal
          eventId={eventId}
          onApplied={() => {
            setShowTemplateModal(false);
            fetchChecklist();
          }}
          onCancel={() => setShowTemplateModal(false)}
        />
      )}
    </div>
  );
}
