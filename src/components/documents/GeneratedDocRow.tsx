"use client";

import { FileText, Eye, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { DocumentWithRelations } from "@/types/database";

interface GeneratedDocRowProps {
  document: DocumentWithRelations;
  onView: (doc: DocumentWithRelations) => void;
  onDelete: (doc: DocumentWithRelations) => void;
}

export function GeneratedDocRow({
  document,
  onView,
  onDelete,
}: GeneratedDocRowProps) {
  const sizeKb = Math.round(document.file_size_bytes / 1024);
  const date = new Date(document.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex items-center gap-4 px-4 py-3 border border-border rounded-lg bg-card">
      <div className="flex-shrink-0 text-muted-foreground/60">
        <FileText className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {document.filename}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {document.event_name && (
            <span>{document.event_name} &middot; </span>
          )}
          {date} &middot; {sizeKb} KB
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onView(document)}
          aria-label="View document"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <a
          href={`/api/documents/${document.id}/download`}
          download
          className="inline-flex"
        >
          <Button variant="ghost" size="icon-sm" aria-label="Download document">
            <Download className="w-4 h-4" />
          </Button>
        </a>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(document)}
          aria-label="Delete document"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
