"use client";

import { useCallback, useState, useRef } from "react";
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  CheckCircle,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

/* ============================================
   PDF UPLOAD COMPONENT
   ============================================
   Drag-and-drop PDF file upload with validation.
   Ghostly-themed styling for PDF invoice import.
   ============================================ */

interface PDFUploadProps {
  onFileSelect: (file: File) => void;
  maxSizeMB?: number;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export function PDFUpload({
  onFileSelect,
  maxSizeMB = 10,
  isLoading = false,
  error = null,
  className,
}: PDFUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
      const isValidType =
        fileExtension === ".pdf" || file.type === "application/pdf";

      if (!isValidType) {
        return "Invalid file type. Please upload a PDF file.";
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        return `File too large. Maximum size is ${maxSizeMB}MB.`;
      }

      return null;
    },
    [maxSizeBytes, maxSizeMB],
  );

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setLocalError(validationError);
        setSelectedFile(null);
        return;
      }

      setLocalError(null);
      setSelectedFile(file);
      onFileSelect(file);
    },
    [validateFile, onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
  );

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setLocalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const displayError = error || localError;

  return (
    <div className={cn("space-y-4", className)} data-oid="dmb-n-o">
      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Click or press Enter to select a PDF file"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-all duration-200",
          "bg-background hover:bg-card cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-spectral focus:ring-offset-2",
          isDragging
            ? "border-spectral bg-spectral/10 scale-[1.01]"
            : "border-border hover:border-border",
          displayError && "border-destructive/50 bg-red-400/10",
          isLoading && "opacity-60 pointer-events-none",
        )}
        onClick={handleBrowseClick}
        data-oid="brz6j-v"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="sr-only"
          disabled={isLoading}
          data-oid="7_4yw77"
        />

        <div
          className="flex flex-col items-center text-center"
          data-oid="dfaxui7"
        >
          {/* Icon */}
          <div
            className={cn(
              "p-4 rounded-full mb-4 transition-colors",
              isDragging
                ? "bg-spectral/10 text-spectral"
                : "bg-spectral/10 text-muted-foreground",
            )}
            data-oid="e9-8myl"
          >
            {isDragging ? (
              <Upload className="w-8 h-8" data-oid=":9-ttoj" />
            ) : (
              <File className="w-8 h-8" data-oid="gj43291" />
            )}
          </div>

          {/* Text */}
          <h3
            className="font-semibold text-foreground mb-1"
            data-oid=":z4dk2z"
          >
            {isDragging ? "Drop your PDF here" : "Upload PDF Invoice"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4" data-oid="b7y5.5g">
            Drag and drop your PDF invoice here, or click to browse
          </p>

          {/* Browse Button */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowseClick();
            }}
            disabled={isLoading}
            data-oid="r1_27bp"
          >
            Browse Files
          </Button>

          {/* File Info */}
          <p className="text-xs text-muted-foreground/60 mt-4" data-oid="yhyjt4g">
            Accepted: PDF files &middot; Max size: {maxSizeMB}MB
          </p>
        </div>
      </div>

      {/* Selected File Display */}
      {selectedFile && !displayError && (
        <div
          className="flex items-center gap-3 p-3 bg-emerald-400/10 border border-emerald-400/30 rounded-lg"
          data-oid="nk86let"
        >
          <div className="p-2 bg-emerald-400/10 rounded" data-oid="5ld013z">
            <FileText className="w-5 h-5 text-emerald-400" data-oid="p6u.p5i" />
          </div>
          <div className="flex-1 min-w-0" data-oid="kv4cn1m">
            <p
              className="font-medium text-foreground truncate"
              data-oid="cjxlm0h"
            >
              {selectedFile.name}
            </p>
            <p className="text-xs text-muted-foreground" data-oid="arzrxy0">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div className="flex items-center gap-2" data-oid="z3mgp3z">
            <CheckCircle
              className="w-5 h-5 text-emerald-400"
              data-oid="j147_6a"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearFile();
              }}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              disabled={isLoading}
              aria-label="Remove selected file"
              data-oid="-zoghxu"
            >
              <X className="w-4 h-4" data-oid="j:cwgs:" />
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {displayError && (
        <div
          className="flex items-start gap-3 p-3 bg-red-400/10 border border-destructive/30 rounded-lg"
          data-oid="80pv3d2"
        >
          <AlertCircle
            className="w-5 h-5 text-destructive shrink-0 mt-0.5"
            data-oid="0g6o50n"
          />
          <div className="flex-1" data-oid="brpm0t8">
            <p className="font-medium text-destructive" data-oid="d6n_q10">
              Upload Error
            </p>
            <p className="text-sm text-destructive/80" data-oid="64vnf9i">
              {displayError}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearFile();
            }}
            className="p-1 text-destructive/60 hover:text-destructive transition-colors"
            data-oid="7lodzkc"
          >
            <X className="w-4 h-4" data-oid="w:4rt7h" />
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div
          className="flex items-center justify-center gap-2 text-muted-foreground"
          data-oid="uy6u8a-"
        >
          <div
            className="w-4 h-4 border-2 border-spectral border-t-spectral rounded-full animate-spin"
            data-oid="wdrlq:l"
          />
          <span className="text-sm" data-oid="ghpyjgh">
            Extracting text from PDF...
          </span>
        </div>
      )}
    </div>
  );
}

export default PDFUpload;
