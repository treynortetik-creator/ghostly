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
        bg: "bg-ink-green/15",
        border: "border-ink-green/30",
        text: "text-ink-green",
        icon: CheckCircle,
        label: "High confidence",
      },
      medium: {
        bg: "bg-ink-gold/15",
        border: "border-ink-gold/30",
        text: "text-ink-gold",
        icon: CheckCircle,
        label: "Medium confidence",
      },
      low: {
        bg: "bg-sepia/15",
        border: "border-sepia/30",
        text: "text-sepia",
        icon: AlertTriangle,
        label: "Low confidence",
      },
      none: {
        bg: "bg-ink-red/15",
        border: "border-ink-red/30",
        text: "text-ink-red",
        icon: AlertTriangle,
        label: "Not detected",
      },
    };
    return badges[level];
  };

  return (
    <div className={cn("space-y-6", className)} data-oid="xdufe3b">
      {/* File Info Card */}
      <Card data-oid="n57tz7f">
        <CardHeader className="pb-3" data-oid="6svphv4">
          <CardTitle
            className="flex items-center gap-2 text-lg"
            data-oid="xt4ndt6"
          >
            <FileText className="w-5 h-5 text-ink-gold" data-oid="uh_oxbh" />
            Uploaded Document
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0" data-oid="zy90fjf">
          <div
            className="flex items-center justify-between text-sm"
            data-oid="fprwhrc"
          >
            <span className="font-medium text-ink-black" data-oid="4p7y.:z">
              {fileName}
            </span>
            <span className="text-sepia" data-oid="vbpndck">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Extracted Data Card */}
      <Card elevated data-oid="u:_5q7k">
        <CardHeader data-oid="dykuqs7">
          <CardTitle className="flex items-center gap-2" data-oid="rfaz:7g">
            <Edit3 className="w-5 h-5 text-ink-gold" data-oid="qywp_9:" />
            Extracted Information
          </CardTitle>
          <p className="text-sm text-sepia mt-1" data-oid="v89geon">
            Review and edit the extracted details. Fields marked with low
            confidence may need manual correction.
          </p>
        </CardHeader>
        <CardContent className="space-y-6" data-oid="ltr3::l">
          {/* Vendor Field */}
          <div className="space-y-2" data-oid="i.e:gjh">
            <div
              className="flex items-center justify-between"
              data-oid="ua6_lkg"
            >
              <label
                className="flex items-center gap-2 text-sm font-medium text-wood-dark"
                data-oid="ll13d33"
              >
                <Building2 className="w-4 h-4 text-sepia" data-oid=":q4wqrt" />
                Vendor / Company
              </label>
              <ConfidenceBadge
                level={extractedData.confidence.vendor}
                data-oid="qck826t"
              />
            </div>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Enter vendor name"
              className={cn(
                "w-full px-3 py-2 text-sm rounded-md",
                "bg-parchment border border-wood-medium/40",
                "focus:outline-none focus:ring-2 focus:ring-ink-gold/30 focus:border-wood-medium",
                "placeholder:text-sepia/50",
              )}
              data-oid="nr16tlv"
            />
          </div>

          {/* Amount Field */}
          <div className="space-y-2" data-oid="i2p:.2g">
            <div
              className="flex items-center justify-between"
              data-oid=":-8ifs."
            >
              <label
                className="flex items-center gap-2 text-sm font-medium text-wood-dark"
                data-oid="6d3l-j-"
              >
                <DollarSign className="w-4 h-4 text-sepia" data-oid="m1.t7yf" />
                Amount
              </label>
              <ConfidenceBadge
                level={extractedData.confidence.amount}
                data-oid="e.zxxrz"
              />
            </div>
            <div className="relative" data-oid="gfxc0mt">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia"
                data-oid="wgp0.93"
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
                  "bg-parchment border border-wood-medium/40",
                  "focus:outline-none focus:ring-2 focus:ring-ink-gold/30 focus:border-wood-medium",
                  "placeholder:text-sepia/50",
                )}
                data-oid="9u39rtj"
              />
            </div>
            {amount && parseFloat(amount) > 0 && (
              <p className="text-xs text-sepia" data-oid="_wl3nbv">
                {formatCurrency(parseFloat(amount))}
              </p>
            )}
          </div>

          {/* Date Field */}
          <div className="space-y-2" data-oid="fek2t7r">
            <div
              className="flex items-center justify-between"
              data-oid="we.rdn2"
            >
              <label
                className="flex items-center gap-2 text-sm font-medium text-wood-dark"
                data-oid="_c3p8k7"
              >
                <Calendar className="w-4 h-4 text-sepia" data-oid="ug.6685" />
                Expense Date
              </label>
              <ConfidenceBadge
                level={extractedData.confidence.date}
                data-oid="pgswdqe"
              />
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(
                "w-full px-3 py-2 text-sm rounded-md",
                "bg-parchment border border-wood-medium/40",
                "focus:outline-none focus:ring-2 focus:ring-ink-gold/30 focus:border-wood-medium",
              )}
              data-oid="o:tse86"
            />
          </div>
        </CardContent>
      </Card>

      {/* Raw Text Preview (collapsed by default) */}
      <details className="group" data-oid="9q-d0rf">
        <summary
          className="cursor-pointer text-sm text-sepia hover:text-wood-dark transition-colors flex items-center gap-2"
          data-oid="jgwpm-t"
        >
          <span
            className="transform transition-transform group-open:rotate-90"
            data-oid="9gbhzhd"
          >
            &#9654;
          </span>
          View extracted text
        </summary>
        <Card className="mt-2" data-oid="4u:ossq">
          <CardContent className="py-4" data-oid="i77wqaf">
            <pre
              className="text-xs text-sepia whitespace-pre-wrap font-mono bg-parchment p-3 rounded border border-wood-medium/20 max-h-48 overflow-y-auto"
              data-oid="8v4a30u"
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
      bg: "bg-ink-green/15",
      border: "border-ink-green/30",
      text: "text-ink-green",
      icon: CheckCircle,
      label: "High",
    },
    medium: {
      bg: "bg-ink-gold/15",
      border: "border-ink-gold/30",
      text: "text-ink-gold",
      icon: CheckCircle,
      label: "Medium",
    },
    low: {
      bg: "bg-sepia/15",
      border: "border-sepia/30",
      text: "text-sepia",
      icon: AlertTriangle,
      label: "Low",
    },
    none: {
      bg: "bg-ink-red/15",
      border: "border-ink-red/30",
      text: "text-ink-red",
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
      data-oid="9ngmbpq"
    >
      <Icon className="w-3 h-3" data-oid="zqnk7b0" />
      {badge.label}
    </span>
  );
}

export default PDFPreview;
