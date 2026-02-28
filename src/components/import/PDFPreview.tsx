"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Building2,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

/* ============================================
   PDF PREVIEW COMPONENT
   ============================================
   Shows extracted PDF data with editable fields.
   Allows user to correct extracted values before saving.
   ============================================ */

export interface ExtractedData {
  vendor: string | null;
  amount: number | null;
  date: string | null;
  rawText: string;
  confidence: {
    vendor: "high" | "medium" | "low" | "none";
    amount: "high" | "medium" | "low" | "none";
    date: "high" | "medium" | "low" | "none";
  };
}

export interface EditableExpenseData {
  vendor: string;
  amount: number | null;
  date: string;
}

interface PDFPreviewProps {
  fileName: string;
  pageCount: number;
  extractedData: ExtractedData;
  onDataChange: (data: EditableExpenseData) => void;
  className?: string;
}

export function PDFPreview({
  fileName,
  pageCount,
  extractedData,
  onDataChange,
  className,
}: PDFPreviewProps) {
  // Initialize editable state from extracted data
  const [vendor, setVendor] = useState(extractedData.vendor || "");
  const [amount, setAmount] = useState<string>(
    extractedData.amount !== null ? extractedData.amount.toFixed(2) : "",
  );
  const [date, setDate] = useState(extractedData.date || "");

  // Update parent when values change
  useEffect(() => {
    const parsedAmount = parseFloat(amount);
    onDataChange({
      vendor,
      amount: isNaN(parsedAmount) ? null : parsedAmount,
      date,
    });
  }, [vendor, amount, date, onDataChange]);

  // Confidence badge styling
  const getConfidenceBadge = (level: "high" | "medium" | "low" | "none") => {
    const badges = {
      high: {
        bg: "bg-emerald-400/10",
        border: "border-emerald-400/30",
        text: "text-emerald-400",
        icon: CheckCircle,
        label: "High confidence",
      },
      medium: {
        bg: "bg-spectral/10",
        border: "border-spectral",
        text: "text-spectral",
        icon: CheckCircle,
        label: "Medium confidence",
      },
      low: {
        bg: "bg-muted-foreground/15",
        border: "border-muted-foreground/30",
        text: "text-muted-foreground",
        icon: AlertTriangle,
        label: "Low confidence",
      },
      none: {
        bg: "bg-red-400/10",
        border: "border-destructive/30",
        text: "text-destructive",
        icon: AlertTriangle,
        label: "Not detected",
      },
    };
    return badges[level];
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* File Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle
            className="flex items-center gap-2 text-lg"
           
          >
            <FileText className="w-5 h-5 text-spectral" />
            Uploaded Document
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            className="flex items-center justify-between text-sm"
           
          >
            <span className="font-medium text-foreground">
              {fileName}
            </span>
            <span className="text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Extracted Data Card */}
      <Card elevated>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-spectral" />
            Extracted Information
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Review and edit the extracted details. Fields marked with low
            confidence may need manual correction.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Vendor Field */}
          <div className="space-y-2">
            <div
              className="flex items-center justify-between"
             
            >
              <label
                className="flex items-center gap-2 text-sm font-medium text-foreground"
               
              >
                <Building2 className="w-4 h-4 text-muted-foreground" />
                Vendor / Company
              </label>
              <ConfidenceBadge
                level={extractedData.confidence.vendor}
               
              />
            </div>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Enter vendor name"
              className={cn(
                "w-full px-3 py-2 text-sm rounded-md",
                "bg-background border border-border",
                "focus:outline-none focus:ring-2 focus:ring-spectral/30 focus:border-border",
                "placeholder:text-muted-foreground/60",
              )}
             
            />
          </div>

          {/* Amount Field */}
          <div className="space-y-2">
            <div
              className="flex items-center justify-between"
             
            >
              <label
                className="flex items-center gap-2 text-sm font-medium text-foreground"
               
              >
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                Amount
              </label>
              <ConfidenceBadge
                level={extractedData.confidence.amount}
               
              />
            </div>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
               
              >
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className={cn(
                  "w-full pl-7 pr-3 py-2 text-sm rounded-md",
                  "bg-background border border-border",
                  "focus:outline-none focus:ring-2 focus:ring-spectral/30 focus:border-border",
                  "placeholder:text-muted-foreground/60",
                )}
               
              />
            </div>
            {amount && parseFloat(amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(parseFloat(amount))}
              </p>
            )}
          </div>

          {/* Date Field */}
          <div className="space-y-2">
            <div
              className="flex items-center justify-between"
             
            >
              <label
                className="flex items-center gap-2 text-sm font-medium text-foreground"
               
              >
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Expense Date
              </label>
              <ConfidenceBadge
                level={extractedData.confidence.date}
               
              />
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(
                "w-full px-3 py-2 text-sm rounded-md",
                "bg-background border border-border",
                "focus:outline-none focus:ring-2 focus:ring-spectral/30 focus:border-border",
              )}
             
            />
          </div>
        </CardContent>
      </Card>

      {/* Raw Text Preview (collapsed by default) */}
      <details className="group">
        <summary
          className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
         
        >
          <span
            className="transform transition-transform group-open:rotate-90"
           
          >
            &#9654;
          </span>
          View extracted text
        </summary>
        <Card className="mt-2">
          <CardContent className="py-4">
            <pre
              className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-background p-3 rounded border border-border max-h-48 overflow-y-auto"
             
            >
              {extractedData.rawText || "No text extracted"}
            </pre>
          </CardContent>
        </Card>
      </details>
    </div>
  );
}

// Confidence Badge Component
function ConfidenceBadge({
  level,
}: {
  level: "high" | "medium" | "low" | "none";
}) {
  const badges = {
    high: {
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/30",
      text: "text-emerald-400",
      icon: CheckCircle,
      label: "High",
    },
    medium: {
      bg: "bg-spectral/10",
      border: "border-spectral",
      text: "text-spectral",
      icon: CheckCircle,
      label: "Medium",
    },
    low: {
      bg: "bg-muted-foreground/15",
      border: "border-muted-foreground/30",
      text: "text-muted-foreground",
      icon: AlertTriangle,
      label: "Low",
    },
    none: {
      bg: "bg-red-400/10",
      border: "border-destructive/30",
      text: "text-destructive",
      icon: AlertTriangle,
      label: "Not found",
    },
  };

  const badge = badges[level];
  const Icon = badge.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border",
        badge.bg,
        badge.border,
        badge.text,
      )}
     
    >
      <Icon className="w-3 h-3" />
      {badge.label}
    </span>
  );
}

export default PDFPreview;
