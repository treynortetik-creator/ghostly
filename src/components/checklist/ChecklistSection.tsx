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
  items: (EventChecklistItem & { assignee?: TeamMember | null })[];
  onToggle: (itemId: string, completed: boolean) => void;
}

export function ChecklistSection({
  phase,
  items,
  onToggle,
}: ChecklistSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const completed = items.filter((i) => i.completed_at).length;
  const total = items.length;

  if (total === 0) return null;

  return (
    <Card className="overflow-hidden" data-oid="up4taay">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-wood-dark/5 hover:bg-wood-dark/10 transition-colors"
        data-oid="vx9fppb"
      >
        <div className="flex items-center gap-2" data-oid="xww4354">
          {isOpen ? (
            <ChevronDown
              className="w-4 h-4 text-wood-medium"
              data-oid="9g6y3cw"
            />
          ) : (
            <ChevronRight
              className="w-4 h-4 text-wood-medium"
              data-oid="d3f561k"
            />
          )}
          <h4
            className="font-serif text-sm font-semibold text-wood-dark"
            data-oid="qzgllh6"
          >
            {checklistPhaseLabels[phase]}
          </h4>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            completed === total && total > 0
              ? "bg-ink-green/20 text-ink-green"
              : "bg-wood-medium/10 text-sepia"
          }`}
          data-oid=".w_g18."
        >
          {completed}/{total}
        </span>
      </button>

      {isOpen && (
        <div data-oid="gfvzamm">
          {items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={onToggle}
              data-oid="30p4r8e"
            />
          ))}
        </div>
      )}
    </Card>
  );
}
