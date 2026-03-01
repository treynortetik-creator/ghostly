"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { SectionContentType } from "@/types/database";

export interface SectionData {
  id: string;
  title: string;
  content_type: SectionContentType;
  ai_instructions: string;
  default_content: string;
}

const CONTENT_TYPE_COLORS: Record<SectionContentType, string> = {
  text: "bg-blue-500/15 text-blue-400",
  table: "bg-emerald-500/15 text-emerald-400",
  list: "bg-amber-500/15 text-amber-400",
  custom: "bg-purple-500/15 text-purple-400",
};

const CONTENT_TYPE_OPTIONS: { value: SectionContentType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "table", label: "Table" },
  { value: "list", label: "List" },
  { value: "custom", label: "Custom" },
];

const inputClass =
  "w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral focus:border-transparent";

interface SortableSectionProps {
  section: SectionData;
  onChange: (id: string, field: keyof SectionData, value: string) => void;
  onDelete: (id: string) => void;
}

export function SortableSection({
  section,
  onChange,
  onDelete,
}: SortableSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-border rounded-lg bg-card"
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Collapse section" : "Expand section"}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {section.title || "Untitled Section"}
        </span>

        <span
          className={`text-xs px-2 py-0.5 rounded ${
            CONTENT_TYPE_COLORS[section.content_type]
          }`}
        >
          {section.content_type}
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(section.id)}
          aria-label="Delete section"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Title
            </label>
            <input
              type="text"
              value={section.title}
              onChange={(e) => onChange(section.id, "title", e.target.value)}
              className={inputClass}
              placeholder="Section title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Content Type
            </label>
            <select
              value={section.content_type}
              onChange={(e) =>
                onChange(section.id, "content_type", e.target.value)
              }
              className={inputClass}
            >
              {CONTENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              AI Instructions
            </label>
            <textarea
              value={section.ai_instructions}
              onChange={(e) =>
                onChange(section.id, "ai_instructions", e.target.value)
              }
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Instructions for the AI when generating this section..."
            />
          </div>

          {section.content_type === "custom" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Default Content
              </label>
              <textarea
                value={section.default_content}
                onChange={(e) =>
                  onChange(section.id, "default_content", e.target.value)
                }
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Default content for this section..."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
