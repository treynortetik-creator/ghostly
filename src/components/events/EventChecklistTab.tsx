"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, ListChecks, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ChecklistSection } from "@/components/checklist/ChecklistSection";
import { ChecklistItemForm } from "@/components/checklist/ChecklistItemForm";
import { ApplyTemplateModal } from "@/components/checklist/ApplyTemplateModal";
import type {
  EventChecklistItem,
  TeamMember,
  ChecklistPhase,
} from "@/types/database";

interface ChecklistData {
  items: (EventChecklistItem & { assignee?: TeamMember | null })[];
  grouped: Record<
    ChecklistPhase,
    (EventChecklistItem & { assignee?: TeamMember | null })[]
  >;
  total: number;
  completed: number;
}

interface EventChecklistTabProps {
  eventId: string;
  tier?: string | null;
}

const CATEGORY_FILTERS = [
  { label: "All", value: "all" },
  { label: "Planning", value: "planning" },
  { label: "Logistics", value: "logistics" },
  { label: "Materials", value: "materials" },
  { label: "Comms", value: "comms" },
  { label: "Post-Event", value: "post-event" },
] as const;

export function EventChecklistTab({ eventId, tier }: EventChecklistTabProps) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

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
    const res = await fetch("/api/team");
    const json = await res.json();
    setTeamMembers(json.team_members || []);
  }, []);

  useEffect(() => {
    fetchChecklist();
    fetchTeamMembers();
  }, [fetchChecklist, fetchTeamMembers]);

  const handleToggle = async (itemId: string, completed: boolean) => {
    await fetch(`/api/events/${eventId}/checklist/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const handleGenerateTasks = async () => {
    if (!tier) {
      setGenerateMessage({ type: "warning", text: "Set event tier first to generate pipeline tasks" });
      return;
    }
    setIsGenerating(true);
    setGenerateMessage(null);
    try {
      const res = await fetch(`/api/events/${eventId}/checklist/generate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setGenerateMessage({ type: "error", text: json.error || "Failed to generate tasks" });
        return;
      }
      if (json.items_added === 0) {
        setGenerateMessage({ type: "warning", text: json.message || "No new tasks to add" });
      } else {
        setGenerateMessage({ type: "success", text: `Added ${json.items_added} pipeline task${json.items_added !== 1 ? "s" : ""}${json.items_skipped > 0 ? ` (${json.items_skipped} already existed)` : ""}` });
      }
      fetchChecklist();
    } catch {
      setGenerateMessage({ type: "error", text: "Failed to generate pipeline tasks" });
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter items by category (client-side)
  const filterByCategory = (items: (EventChecklistItem & { assignee?: TeamMember | null })[]) => {
    if (categoryFilter === "all") return items;
    return items.filter(item => item.category === categoryFilter);
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground" data-oid="pecs0im">
        Loading checklist...
      </div>
    );
  }

  const total = data?.total || 0;
  const completed = data?.completed || 0;
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="space-y-4" data-oid="82h0hww">
      {/* Header with progress */}
      <div className="flex items-center justify-between" data-oid="-nmyq2m">
        <div className="flex items-center gap-3" data-oid="4p:snnu">
          <h3
            className="text-lg font-semibold text-foreground"
            data-oid=".qegadb"
          >
            Task Ledger
          </h3>
          {total > 0 && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                completed === total
                  ? "bg-emerald-400/10 text-emerald-400"
                  : "bg-spectral/10 text-muted-foreground"
              }`}
              data-oid="da8jzp0"
            >
              {completed}/{total}
            </span>
          )}
        </div>
        <div className="flex gap-2" data-oid="obmyq1v">
          <Button
            variant="accent"
            size="sm"
            leftIcon={<Sparkles className="w-4 h-4" />}
            onClick={handleGenerateTasks}
            isLoading={isGenerating}
          >
            Generate Tasks
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileText className="w-4 h-4" data-oid="zo:c_of" />}
            onClick={() => setShowTemplateModal(true)}
            data-oid="01k:yfl"
          >
            Apply Template
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" data-oid="rlp6m26" />}
            onClick={() => setShowAddForm(true)}
            data-oid="8xa9qvk"
          >
            Add Task
          </Button>
        </div>
      </div>

      {/* Generate message */}
      {generateMessage && (
        <div
          className={`text-sm px-3 py-2 rounded border ${
            generateMessage.type === "success"
              ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
              : generateMessage.type === "error"
                ? "bg-red-400/10 text-destructive border-destructive/30"
                : "bg-spectral/10 text-spectral border-spectral"
          }`}
        >
          {generateMessage.text}
        </div>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <ProgressBar value={progressPercent} max={100} data-oid="daxu08a" />
      )}

      {/* Category filter pills */}
      {total > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setCategoryFilter(filter.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === filter.value
                  ? "bg-ghost-light text-spectral"
                  : "text-muted-foreground/60 hover:bg-card border border-border"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Checklist sections */}
      {total === 0 ? (
        <div className="text-center py-8 text-muted-foreground" data-oid="0qwcj9x">
          <ListChecks
            className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60"
            data-oid="5a-vcan"
          />
          <p className="" data-oid="fcq2q4m">
            No tasks on the ledger
          </p>
          <p className="text-sm mt-1" data-oid="txrh9h9">
            Apply a template or add individual tasks to begin.
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-oid="nw-l:e_">
          {(["pre_event", "day_of", "post_event"] as ChecklistPhase[]).map(
            (phase) => (
              <ChecklistSection
                key={phase}
                phase={phase}
                items={filterByCategory(data?.grouped[phase] || [])}
                onToggle={handleToggle}
                data-oid="t5s.1fo"
              />
            ),
          )}
        </div>
      )}

      {/* Modals */}
      {showAddForm && (
        <ChecklistItemForm
          teamMembers={teamMembers}
          onSave={handleAddItem}
          onCancel={() => setShowAddForm(false)}
          isLoading={isAdding}
          data-oid="zttw1pv"
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
          data-oid="nbvvs6s"
        />
      )}
    </div>
  );
}
