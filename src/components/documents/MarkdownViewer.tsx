"use client";

import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface MarkdownViewerProps {
  documentId: string;
  filename: string;
  content: string;
  onClose: () => void;
}

export function MarkdownViewer({
  documentId,
  filename,
  content,
  onClose,
}: MarkdownViewerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg border border-border glass-shadow w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-foreground truncate">
            {filename}
          </h2>
          <div className="flex items-center gap-2">
            <a
              href={`/api/documents/${documentId}/download`}
              download
              className="inline-flex"
            >
              <Button variant="secondary" size="sm">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </a>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}
