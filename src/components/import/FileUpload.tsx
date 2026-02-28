"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, FileText, X, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

/* ============================================
   FILE UPLOAD COMPONENT
   ============================================
   Drag-and-drop CSV file upload with validation.
   Ghostly-themed styling with ghost background.
   ============================================ */

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export function FileUpload({
  onFileSelect,
  accept = ".csv",
  maxSizeMB = 10,
  isLoading = false,
  error = null,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file type
      const acceptedTypes = accept
        .split(",")
        .map((t) => t.trim().toLowerCase());
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
      const fileType = file.type.toLowerCase();

      const isValidType =
        acceptedTypes.includes(fileExtension) ||
        acceptedTypes.includes(fileType) ||
        acceptedTypes.some((t) => fileType.includes(t.replace(".", "")));

      if (!isValidType) {
        return `Invalid file type. Please upload a ${accept} file.`;
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        return `File too large. Maximum size is ${maxSizeMB}MB.`;
      }

      return null;
    },
    [accept, maxSizeBytes, maxSizeMB],
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
    <div className={cn("space-y-4", className)} data-oid="jr0.lfg">
      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Click or press Enter to select a CSV file"
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
        data-oid="p:p:c1_"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="sr-only"
          disabled={isLoading}
          data-oid="o647imi"
        />

        <div
          className="flex flex-col items-center text-center"
          data-oid="99uiebh"
        >
          {/* Icon */}
          <div
            className={cn(
              "p-4 rounded-full mb-4 transition-colors",
              isDragging
                ? "bg-spectral/10 text-spectral"
                : "bg-spectral/10 text-muted-foreground",
            )}
            data-oid="l422net"
          >
            <Upload className="w-8 h-8" data-oid="fou984b" />
          </div>

          {/* Text */}
          <h3
            className="font-semibold text-foreground mb-1"
            data-oid="nmf2ab9"
          >
            {isDragging ? "Drop your file here" : "Upload CSV File"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4" data-oid="bq:na44">
            Drag and drop your Brex export here, or click to browse
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
            data-oid="fkvdd1m"
          >
            Browse Files
          </Button>

          {/* File Info */}
          <p className="text-xs text-muted-foreground/60 mt-4" data-oid="ikmbeiz">
            Accepted: {accept} &middot; Max size: {maxSizeMB}MB
          </p>
        </div>
      </div>

      {/* Selected File Display */}
      {selectedFile && !displayError && (
        <div
          className="flex items-center gap-3 p-3 bg-emerald-400/10 border border-emerald-400/30 rounded-lg"
          data-oid="l7l:u4g"
        >
          <div className="p-2 bg-emerald-400/10 rounded" data-oid="phlnyx.">
            <FileText className="w-5 h-5 text-emerald-400" data-oid="4.y0fyl" />
          </div>
          <div className="flex-1 min-w-0" data-oid="9ndiy9x">
            <p
              className="font-medium text-foreground truncate"
              data-oid="zvtv0rl"
            >
              {selectedFile.name}
            </p>
            <p className="text-xs text-muted-foreground" data-oid="n.b_h:j">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div className="flex items-center gap-2" data-oid="g2xnzaf">
            <CheckCircle
              className="w-5 h-5 text-emerald-400"
              data-oid="nli80n7"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearFile();
              }}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              disabled={isLoading}
              aria-label="Remove selected file"
              data-oid="0xr-m17"
            >
              <X className="w-4 h-4" data-oid=":z_ebib" />
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {displayError && (
        <div
          className="flex items-start gap-3 p-3 bg-red-400/10 border border-destructive/30 rounded-lg"
          data-oid="9judt4u"
        >
          <AlertCircle
            className="w-5 h-5 text-destructive shrink-0 mt-0.5"
            data-oid="6b-_w54"
          />
          <div className="flex-1" data-oid="e18h01h">
            <p className="font-medium text-destructive" data-oid=":oztd_e">
              Upload Error
            </p>
            <p className="text-sm text-destructive/80" data-oid="bshuvp7">
              {displayError}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearFile();
            }}
            className="p-1 text-destructive/60 hover:text-destructive transition-colors"
            data-oid="3uod091"
          >
            <X className="w-4 h-4" data-oid="k7f4b0f" />
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div
          className="flex items-center justify-center gap-2 text-muted-foreground"
          data-oid="s.-ws6n"
        >
          <div
            className="w-4 h-4 border-2 border-spectral border-t-spectral rounded-full animate-spin"
            data-oid="y9c3lk8"
          />
          <span className="text-sm" data-oid="l-oicon">
            Processing file...
          </span>
        </div>
      )}
    </div>
  );
}

export default FileUpload;
