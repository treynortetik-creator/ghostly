"use client";

import { Check, User, Calendar } from "lucide-react";
import type { EventChecklistItem, TeamMember } from "@/types/database";

interface ChecklistItemProps {
  item: EventChecklistItem & { assignee?: TeamMember | null };
  onToggle: (itemId: string, completed: boolean) => void;
}

export function ChecklistItem({ item, onToggle }: ChecklistItemProps) {
  const isCompleted = !!item.completed_at;
  const assignee = item.assignee as TeamMember | null | undefined;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-wood-medium/10 last:border-b-0 transition-colors ${
        isCompleted ? "bg-ink-green/5" : "hover:bg-parchment-dark/50"
      }`}
      data-oid="6kaj849"
    >
      <button
        onClick={() => onToggle(item.id, !isCompleted)}
        className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border transition-all ${
          isCompleted
            ? "bg-ink-green border-ink-green text-parchment"
            : "border-wood-medium/40 hover:border-ink-gold"
        } flex items-center justify-center`}
        data-oid="yfs.rd:"
      >
        {isCompleted && <Check className="w-3.5 h-3.5" data-oid="7-63f16" />}
      </button>

      <div className="flex-1 min-w-0" data-oid="mzntd-3">
        <p
          className={`text-sm ${isCompleted ? "line-through text-sepia/60" : "text-ink-black"}`}
          data-oid="h857:_o"
        >
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-sepia/60 mt-0.5" data-oid=".ggygv:">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5" data-oid="odq_r:u">
          {assignee && (
            <span
              className="flex items-center gap-1 text-xs text-sepia/70"
              data-oid="97gmyuc"
            >
              <User className="w-3 h-3" data-oid="iv2mf1i" />
              {assignee.name}
            </span>
          )}
          {item.due_date && (
            <span
              className={`flex items-center gap-1 text-xs ${
                !isCompleted && new Date(item.due_date) < new Date()
                  ? "text-ink-red"
                  : "text-sepia/70"
              }`}
              data-oid="x_xtcxg"
            >
              <Calendar className="w-3 h-3" data-oid="3k:ecqd" />
              {new Date(item.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
