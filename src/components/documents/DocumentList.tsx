"use client";

import { useState } from "react";
import { Download, Trash2, FileText, File, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { formatDateShort } from "@/lib/format";

interface DocumentItem {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  source: string;
  uploaded_by: string;
  created_at: string;
}

interface DocumentListProps {
  documents: DocumentItem[];
  onDelete?: (id: string) => void;
  showDeleteButton?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return "📄";
  return "📝";
}

export function DocumentList({
  documents,
  onDelete,
  showDeleteButton = true,
}: DocumentListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { toasts, removeToast, toast } = useToast();

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      onDelete?.(id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleDownload = (id: string, filename: string) => {
    // Open download in a new tab/window
    window.open(`/api/documents/${id}/download`, "_blank");
  };

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="w-12 h-12" />}
        title="No Documents Attached"
        description="Upload a PDF or DOCX to attach it here."
      />
    );
  }

  return (
    <div className="space-y-2">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {documents.map((doc) => (
        <div key={doc.id}>
          <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-border transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xl flex-shrink-0">
                {getFileIcon(doc.mime_type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">
                  {doc.original_filename}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {formatFileSize(doc.file_size_bytes)} ·{" "}
                  Uploaded by {doc.uploaded_by === "user" ? "you" : doc.uploaded_by} ·{" "}
                  {formatDateShort(doc.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-3 flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownload(doc.id, doc.original_filename)}
                title="Download"
              >
                <Download className="w-4 h-4" />
              </Button>

              {showDeleteButton && (
                <>
                  {confirmDeleteId === doc.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        isLoading={deletingId === doc.id}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === doc.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDeleteId(doc.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive/70" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
