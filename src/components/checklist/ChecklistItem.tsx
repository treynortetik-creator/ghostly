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
      className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
        isCompleted ? "bg-emerald-400/10" : "hover:bg-card/50"
      }`}
     
    >
      <button
        onClick={() => onToggle(item.id, !isCompleted)}
        className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded border transition-all ${
          isCompleted
            ? "bg-emerald-400 border-emerald-400 text-phantom"
            : "border-border hover:border-spectral"
        } flex items-center justify-center`}
       
      >
        {isCompleted && <Check className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${isCompleted ? "line-through text-muted-foreground/60" : "text-foreground"}`}
         
        >
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {assignee && (
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground/60"
             
            >
              <User className="w-3 h-3" />
              {assignee.name}
            </span>
          )}
          {item.due_date && (
            <span
              className={`flex items-center gap-1 text-xs ${
                !isCompleted && new Date(item.due_date) < new Date()
                  ? "text-destructive"
                  : "text-muted-foreground/60"
              }`}
             
            >
              <Calendar className="w-3 h-3" />
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
