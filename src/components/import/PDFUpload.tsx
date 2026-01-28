'use client';

import { useCallback, useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/* ============================================
   PDF UPLOAD COMPONENT
   ============================================
   Drag-and-drop PDF file upload with validation.
   Victorian-themed styling for PDF invoice import.
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
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const isValidType = fileExtension === '.pdf' || file.type === 'application/pdf';

      if (!isValidType) {
        return 'Invalid file type. Please upload a PDF file.';
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        return `File too large. Maximum size is ${maxSizeMB}MB.`;
      }

      return null;
    },
    [maxSizeBytes, maxSizeMB]
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
    [validateFile, onFileSelect]
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
    [handleFile]
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
    [handleFile]
  );

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setLocalError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayError = error || localError;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Click or press Enter to select a PDF file"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-all duration-200',
          'bg-parchment hover:bg-parchment-dark cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-ink-gold focus:ring-offset-2',
          isDragging
            ? 'border-ink-gold bg-ink-gold/5 scale-[1.01]'
            : 'border-wood-medium/40 hover:border-wood-medium',
          displayError && 'border-ink-red/50 bg-ink-red/5',
          isLoading && 'opacity-60 pointer-events-none'
        )}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="sr-only"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div
            className={cn(
              'p-4 rounded-full mb-4 transition-colors',
              isDragging
                ? 'bg-ink-gold/20 text-ink-gold'
                : 'bg-wood-medium/10 text-wood-medium'
            )}
          >
            {isDragging ? (
              <Upload className="w-8 h-8" />
            ) : (
              <File className="w-8 h-8" />
            )}
          </div>

          {/* Text */}
          <h3 className="font-serif font-semibold text-wood-dark mb-1">
            {isDragging ? 'Drop your PDF here' : 'Upload PDF Invoice'}
          </h3>
          <p className="text-sm text-sepia mb-4">
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
          >
            Browse Files
          </Button>

          {/* File Info */}
          <p className="text-xs text-sepia/60 mt-4">
            Accepted: PDF files &middot; Max size: {maxSizeMB}MB
          </p>
        </div>
      </div>

      {/* Selected File Display */}
      {selectedFile && !displayError && (
        <div className="flex items-center gap-3 p-3 bg-ink-green/10 border border-ink-green/30 rounded-lg">
          <div className="p-2 bg-ink-green/20 rounded">
            <FileText className="w-5 h-5 text-ink-green" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink-black truncate">
              {selectedFile.name}
            </p>
            <p className="text-xs text-sepia">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-ink-green" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearFile();
              }}
              className="p-1 text-sepia hover:text-ink-red transition-colors"
              disabled={isLoading}
              aria-label="Remove selected file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {displayError && (
        <div className="flex items-start gap-3 p-3 bg-ink-red/10 border border-ink-red/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-ink-red shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-ink-red">Upload Error</p>
            <p className="text-sm text-ink-red/80">{displayError}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearFile();
            }}
            className="p-1 text-ink-red/60 hover:text-ink-red transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-sepia">
          <div className="w-4 h-4 border-2 border-ink-gold/30 border-t-ink-gold rounded-full animate-spin" />
          <span className="text-sm">Extracting text from PDF...</span>
        </div>
      )}
    </div>
  );
}

export default PDFUpload;
