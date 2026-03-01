"use client";

import { FileText, Pencil, Copy, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DocumentTemplate } from "@/types/database";

interface TemplateWithCount extends DocumentTemplate {
  section_count: number;
}

interface TemplateCardProps {
  template: TemplateWithCount;
  onEdit: (template: TemplateWithCount) => void;
  onDuplicate: (template: TemplateWithCount) => void;
  onDelete: (template: TemplateWithCount) => void;
}

export function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
}: TemplateCardProps) {
  return (
    <Card elevated className="relative">
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-spectral/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                {template.name}
              </h3>
              {template.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground/60 mt-1">
                {template.section_count} section
                {template.section_count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(template)}
              aria-label="Edit template"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDuplicate(template)}
              aria-label="Duplicate template"
            >
              <Copy className="w-4 h-4" />
            </Button>
            {!template.is_default && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(template)}
                aria-label="Delete template"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {template.is_default && (
          <span className="absolute top-3 right-14 text-xs px-2 py-0.5 rounded bg-spectral/15 text-spectral">
            Default
          </span>
        )}
      </CardContent>
    </Card>
  );
}
