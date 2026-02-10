"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DocumentUploadProps {
  eventId?: string;
  expenseId?: string;
  onUploadComplete: (doc: any) => void;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return "📄";
  return "📝";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUpload({
  eventId,
  expenseId,
  onUploadComplete,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "pdf" && ext !== "docx") {
        return "Invalid file type. Only PDF and DOCX files are allowed.";
      }
    }
    if (file.size > MAX_SIZE) {
      return "File too large. Maximum size is 10 MB.";
    }
    if (file.size === 0) {
      return "File is empty.";
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (eventId) formData.append("event_id", eventId);
      if (expenseId) formData.append("expense_id", expenseId);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const doc = await response.json();
      onUploadComplete(doc);
      setUploadProgress(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadFile(files[0]);
      }
    },
    [eventId, expenseId]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed p-6
          flex flex-col items-center justify-center text-center
          transition-colors duration-200
          ${
            isDragging
              ? "border-ink-gold bg-ink-gold/5"
              : "border-wood-medium/30 hover:border-wood-medium/50 bg-parchment/50"
          }
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 text-ink-gold animate-spin mb-2" />
            <p className="text-sm text-sepia">{uploadProgress}</p>
          </>
        ) : (
          <>
            <Upload
              className={`w-8 h-8 mb-2 ${isDragging ? "text-ink-gold" : "text-sepia/50"}`}
            />
            <p className="text-sm text-sepia">
              <span className="font-medium text-wood-dark">
                Drop files here
              </span>{" "}
              or click to upload
            </p>
            <p className="text-xs text-sepia/70 mt-1">
              PDF or DOCX — max 10 MB
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-ink-red/5 border border-ink-red/20">
          <X className="w-4 h-4 text-ink-red flex-shrink-0" />
          <p className="text-sm text-ink-red">{error}</p>
        </div>
      )}
    </div>
  );
}
