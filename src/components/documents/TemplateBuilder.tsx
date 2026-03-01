"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/Button";
import { SortableSection, type SectionData } from "./SortableSection";
import { randomId } from "@/lib/utils";
import type { DocumentTemplateWithSections } from "@/types/database";

interface TemplateBuilderProps {
  template?: DocumentTemplateWithSections | null;
  onSave: (data: {
    name: string;
    description: string;
    sections: Omit<SectionData, "id">[];
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const inputClass =
  "w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral focus:border-transparent";

function createEmptySection(): SectionData {
  return {
    id: randomId(),
    title: "",
    content_type: "text",
    ai_instructions: "",
    default_content: "",
  };
}

export function TemplateBuilder({
  template,
  onSave,
  onCancel,
  isLoading,
}: TemplateBuilderProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<SectionData[]>([
    createEmptySection(),
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (template) {
      setName(template.name || "");
      setDescription(template.description || "");
      if (template.sections && template.sections.length > 0) {
        setSections(
          template.sections.map((s) => ({
            id: s.id || randomId(),
            title: s.title || "",
            content_type: s.content_type || "text",
            ai_instructions: s.ai_instructions || "",
            default_content: s.default_content || "",
          }))
        );
      }
    }
  }, [template]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSectionChange = (
    id: string,
    field: keyof SectionData,
    value: string
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleDeleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddSection = () => {
    setSections((prev) => [...prev, createEmptySection()]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      sections: sections.map(({ id: _id, ...rest }) => rest),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg border border-border glass-shadow w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {template ? "Edit Template" : "Create Template"}
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
              placeholder="Template name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="What is this template for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Sections
            </label>
            <div className="space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      onChange={handleSectionChange}
                      onDelete={handleDeleteSection}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddSection}
              className="mt-3"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Section
            </Button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {template ? "Update" : "Create Template"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
