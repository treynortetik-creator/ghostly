"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ChecklistItem } from "./ChecklistItem";
import { Card } from "@/components/ui/Card";
import type {
  ChecklistPhase,
  EventChecklistItem,
  TeamMember,
} from "@/types/database";
import { checklistPhaseLabels } from "@/types/database";

interface ChecklistSectionProps {
  phase: ChecklistPhase;
  /** Optional label override (from configurable phases) */
  phaseLabel?: string;
  items: (EventChecklistItem & { assignee?: TeamMember | null })[];
  onToggle: (itemId: string, completed: boolean) => void;
}

export function ChecklistSection({
  phase,
  phaseLabel,
  items,
  onToggle,
}: ChecklistSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const completed = items.filter((i) => i.completed_at).length;
  const total = items.length;

  if (total === 0) return null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-ghost-dark/5 hover:bg-ghost-dark/10 transition-colors"
       
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown
              className="w-4 h-4 text-muted-foreground"
             
            />
          ) : (
            <ChevronRight
              className="w-4 h-4 text-muted-foreground"
             
            />
          )}
          <h4
            className="text-sm font-semibold text-foreground"
           
          >
            {phaseLabel || checklistPhaseLabels[phase] || phase}
          </h4>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            completed === total && total > 0
              ? "bg-emerald-400/10 text-emerald-400"
              : "bg-spectral/10 text-muted-foreground"
          }`}
         
        >
          {completed}/{total}
        </span>
      </button>

      {isOpen && (
        <div>
          {items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={onToggle}
             
            />
          ))}
        </div>
      )}
    </Card>
  );
}
