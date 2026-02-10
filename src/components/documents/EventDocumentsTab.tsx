"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

interface EventDocumentsTabProps {
  eventId: string;
}

export function EventDocumentsTab({ eventId }: EventDocumentsTabProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/documents`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      const data = await response.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadComplete = (doc: DocumentItem) => {
    setDocuments((prev) => [doc, ...prev]);
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-ink-gold" />
                Documents ({documents.length})
              </CardTitle>
              <CardDescription>
                Contracts, agendas, and venue agreements
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchDocuments}
              disabled={isLoading}
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-4">
              <p className="text-ink-red text-sm">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={fetchDocuments}
              >
                Retry
              </Button>
            </div>
          ) : isLoading && documents.length === 0 ? (
            <div className="animate-pulse space-y-3">
              <div className="h-14 bg-wood-medium/10 rounded-lg" />
              <div className="h-14 bg-wood-medium/10 rounded-lg" />
            </div>
          ) : (
            <>
              <DocumentList
                documents={documents}
                onDelete={handleDelete}
              />

              <div className="mt-4">
                <DocumentUpload
                  eventId={eventId}
                  onUploadComplete={handleUploadComplete}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
