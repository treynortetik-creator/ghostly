"use client";

import { useEffect, useState, useCallback } from "react";
import { Paperclip } from "lucide-react";
import { DocumentUpload } from "./DocumentUpload";
import { DocumentList } from "./DocumentList";

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

interface ExpenseDocumentsSectionProps {
  expenseId: string;
}

export function ExpenseDocumentsSection({
  expenseId,
}: ExpenseDocumentsSectionProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}/documents`);
      if (!response.ok) return;
      const data = await response.json();
      setDocuments(data.documents);
    } catch {
      // Silently fail — this is a supplementary section
    } finally {
      setIsLoading(false);
    }
  }, [expenseId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadComplete = (doc: DocumentItem) => {
    setDocuments((prev) => [doc, ...prev]);
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  if (isLoading) {
    return (
      <div className="mt-6 pt-6 border-t border-border">
        <div className="animate-pulse">
          <div className="h-6 w-40 bg-spectral/10 rounded mb-3" />
          <div className="h-14 bg-spectral/10 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="w-4 h-4 text-spectral" />
        <h3 className="font-semibold text-foreground">
          Attachments ({documents.length})
        </h3>
      </div>

      <DocumentList
        documents={documents}
        onDelete={handleDelete}
      />

      <div className="mt-3">
        <DocumentUpload
          expenseId={expenseId}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    </div>
  );
}
