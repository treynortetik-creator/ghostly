"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  Save,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import { PDFUpload, PDFPreview, AssignmentSelector } from "@/components/import";
import type {
  ExtractedData,
  EditableExpenseData,
} from "@/components/import/PDFPreview";
import type { AssignmentOption } from "@/components/import/AssignmentSelector";

/* ============================================
   PDF INVOICE IMPORT PAGE
   ============================================
   Import flow:
   1. Upload PDF file
   2. Review/edit extracted data (vendor, amount, date)
   3. Select event or category assignment
   4. Confirm and save expense
   Ghostly theme: "The Invoice Archive"
   ============================================ */

type ImportStep = "upload" | "review" | "complete";

interface ParsedPDFResult {
  fileName: string;
  pageCount: number;
  extracted: ExtractedData;
  suggestedAssignment?: {
    id: string | null;
    type: "event" | "category" | null;
    name: string | null;
    confidence: number;
  } | null;
  aiPowered?: boolean;
}

interface SavedExpense {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  assignmentName: string;
  assignmentType: "event" | "category";
}

export default function PDFImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed data
  const [pdfResult, setPdfResult] = useState<ParsedPDFResult | null>(null);
  const [editableData, setEditableData] = useState<EditableExpenseData>({
    vendor: "",
    amount: null,
    date: "",
  });
  const [selectedAssignment, setSelectedAssignment] =
    useState<AssignmentOption | null>(null);
  const [assignmentOptions, setAssignmentOptions] = useState<
    AssignmentOption[]
  >([]);
  const [savedExpense, setSavedExpense] = useState<SavedExpense | null>(null);

  // Load assignment options (events and categories)
  useEffect(() => {
    const abortController = new AbortController();

    const loadOptions = async () => {
      try {
        // Fetch events
        const eventsRes = await fetch("/api/events", {
          signal: abortController.signal,
        });
        const eventsData = await eventsRes.json();

        // Fetch categories
        const categoriesRes = await fetch("/api/categories", {
          signal: abortController.signal,
        });
        const categoriesData = await categoriesRes.json();

        const options: AssignmentOption[] = [
          ...(eventsData.events || []).map(
            (e: {
              id: string;
              name: string;
              event_type_record?: { name: string } | null;
              quarter?: string;
            }) => ({
              id: e.id,
              name: e.name,
              type: "event" as const,
              eventType: e.event_type_record?.name?.toLowerCase() ?? null,
              quarter: e.quarter,
            }),
          ),
          ...(categoriesData.categories || []).map(
            (c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
              type: "category" as const,
            }),
          ),
        ];

        setAssignmentOptions(options);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Expected when component unmounts
        }
        console.error("Failed to load assignment options:", err);
        // Don't show error - options will be empty but user can still proceed
      }
    };

    loadOptions();

    return () => abortController.abort();
  }, []);

  // Handle file upload
  const handleFileSelect = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/import/pdf", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process PDF file");
        }

        const data = await response.json();

        setPdfResult({
          fileName: data.fileName,
          pageCount: data.pageCount,
          extracted: data.extracted,
          suggestedAssignment: data.suggestedAssignment ?? null,
          aiPowered: data.aiPowered ?? false,
        });

        // Pre-select AI suggested assignment
        if (data.suggestedAssignment?.id && data.suggestedAssignment?.type) {
          const suggestedOption = assignmentOptions.find(
            (opt: AssignmentOption) => opt.id === data.suggestedAssignment.id,
          );
          if (suggestedOption) {
            setSelectedAssignment(suggestedOption);
          }
        }

        // Initialize editable data
        setEditableData({
          vendor: data.extracted.vendor || "",
          amount: data.extracted.amount,
          date: data.extracted.date || "",
        });

        setStep("review");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload file");
      } finally {
        setIsLoading(false);
      }
    },
    [assignmentOptions],
  );

  // Handle data changes from preview
  const handleDataChange = useCallback((data: EditableExpenseData) => {
    setEditableData(data);
  }, []);

  // Validate before save
  const validateExpense = (): string | null => {
    if (!editableData.vendor.trim()) {
      return "Vendor name is required";
    }
    if (!editableData.amount || editableData.amount <= 0) {
      return "Valid amount is required";
    }
    if (!editableData.date) {
      return "Expense date is required";
    }
    if (!selectedAssignment) {
      return "Please select an event or category";
    }
    return null;
  };

  // Handle save expense
  const handleSaveExpense = useCallback(async () => {
    const validationError = validateExpense();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const expenseData = {
        vendor: editableData.vendor.trim(),
        amount: editableData.amount,
        expense_date: editableData.date,
        memo: `Imported from PDF: ${pdfResult?.fileName}`,
        source_type: "pdf",
        source_reference: pdfResult?.fileName,
        ...(selectedAssignment?.type === "event"
          ? { event_id: selectedAssignment.id }
          : { category_id: selectedAssignment?.id }),
      };

      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save expense");
      }

      const savedData = await response.json();

      setSavedExpense({
        id: savedData.id || savedData.expense?.id || "exp-new",
        vendor: editableData.vendor,
        amount: editableData.amount!,
        date: editableData.date,
        assignmentName: selectedAssignment?.name || "Unknown",
        assignmentType: selectedAssignment?.type || "category",
      });

      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setIsLoading(false);
    }
  }, [editableData, selectedAssignment, pdfResult]);

  // Reset form
  const handleStartOver = () => {
    setStep("upload");
    setPdfResult(null);
    setEditableData({ vendor: "", amount: null, date: "" });
    setSelectedAssignment(null);
    setSavedExpense(null);
    setError(null);
  };

  return (
    <AppShell>
      {/* Page Header */}
      <div className="mb-8">
        <Link
          href="/import"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
         
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Import Hub
        </Link>

        <h1
          className="text-3xl font-bold text-foreground flex items-center gap-3"
         
        >
          <FileText className="w-8 h-8 text-spectral" />
          PDF Invoice Import
        </h1>
        <p className="mt-1 text-muted-foreground">
          Extract expense details from PDF invoices and receipts
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div
          className="flex items-center justify-between max-w-md"
         
        >
          {["upload", "review", "complete"].map((s, index) => {
            const isActive = s === step;
            const isPast =
              ["upload", "review", "complete"].indexOf(step) > index;

            return (
              <div key={s} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-spectral text-foreground"
                        : isPast
                          ? "bg-emerald-400 text-phantom"
                          : "bg-spectral/10 text-muted-foreground"
                    }
                  `}
                 
                >
                  {isPast ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 2 && (
                  <div
                    className={`
                      w-16 sm:w-28 h-0.5 mx-2
                      ${isPast ? "bg-emerald-400" : "bg-spectral/10"}
                    `}
                   
                  />
                )}
              </div>
            );
          })}
        </div>
        <div
          className="flex justify-between max-w-md mt-2 text-xs text-muted-foreground"
         
        >
          <span>Upload</span>
          <span>Review</span>
          <span>Complete</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="mb-6 flex items-start gap-3 p-4 bg-red-400/10 border border-destructive/30 rounded-lg"
         
        >
          <AlertCircle
            className="w-5 h-5 text-destructive shrink-0 mt-0.5"
           
          />
          <div>
            <p className="font-medium text-destructive">
              Error
            </p>
            <p className="text-sm text-destructive/80">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-spectral" />
              Upload PDF Invoice
            </CardTitle>
            <CardDescription>
              Upload a PDF invoice or receipt to extract expense details. The
              system will attempt to identify the vendor, amount, and date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PDFUpload
              onFileSelect={handleFileSelect}
              maxSizeMB={10}
              isLoading={isLoading}
              error={error}
             
            />

            {/* Info Note */}
            <div
              className="mt-6 flex items-start gap-3 p-4 bg-muted-foreground/10 border border-muted-foreground/30 rounded-lg"
             
            >
              <FileText
                className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5"
               
              />
              <div>
                <p className="font-medium text-foreground">
                  Extraction Tips
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  For best results, upload PDFs with selectable text (not
                  scanned images). The system looks for common invoice patterns
                  to identify vendor names, total amounts, and dates. You can
                  always edit the extracted values before saving.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && pdfResult && (
        <div className="space-y-6">
          {/* AI Powered Badge */}
          {pdfResult.aiPowered && (
            <div
              className="flex items-center gap-2 p-3 bg-spectral/10 border border-spectral rounded-lg"
             
            >
              <Sparkles className="w-4 h-4 text-spectral" />
              <span
                className="text-sm font-medium text-spectral"
               
              >
                AI-Powered Extraction
              </span>
              <span className="text-xs text-muted-foreground">
                — Fields extracted and assignment suggested by AI
              </span>
            </div>
          )}

          {/* Extracted Data Preview */}
          <PDFPreview
            fileName={pdfResult.fileName}
            pageCount={pdfResult.pageCount}
            extractedData={pdfResult.extracted}
            onDataChange={handleDataChange}
           
          />

          {/* Assignment Selector */}
          <Card elevated>
            <CardHeader>
              <CardTitle>
                Assign to Event or Category
              </CardTitle>
              <CardDescription>
                Select which event or budget category this expense belongs to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssignmentSelector
                value={selectedAssignment}
                options={assignmentOptions}
                onChange={setSelectedAssignment}
                placeholder="Select event or category..."
               
              />

              {pdfResult.suggestedAssignment?.confidence != null &&
                selectedAssignment && (
                  <div
                    className="mt-3 flex items-center gap-2"
                   
                  >
                    <span
                      className={`
                    inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                    ${
                      pdfResult.suggestedAssignment.confidence >= 0.7
                        ? "bg-emerald-400/10 text-emerald-400"
                        : pdfResult.suggestedAssignment.confidence >= 0.4
                          ? "bg-spectral/10 text-spectral"
                          : "bg-red-400/10 text-destructive"
                    }
                  `}
                     
                    >
                      AI Confidence:{" "}
                      {Math.round(
                        pdfResult.suggestedAssignment.confidence * 100,
                      )}
                      %
                    </span>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div
            className="flex items-center justify-end gap-4 pt-4 border-t border-border"
           
          >
            <Button
              variant="secondary"
              onClick={handleStartOver}
             
            >
              Start Over
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveExpense}
              disabled={isLoading}
              leftIcon={<Save className="w-4 h-4" />}
             
            >
              {isLoading ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </div>
      )}

      {step === "complete" && savedExpense && (
        <Card elevated>
          <CardContent className="py-12 text-center">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-400/10 mb-6"
             
            >
              <CheckCircle
                className="w-8 h-8 text-emerald-400"
               
              />
            </div>

            <h2
              className="text-2xl font-bold text-foreground mb-2"
             
            >
              Expense Saved!
            </h2>
            <p className="text-muted-foreground mb-8">
              Your invoice has been successfully imported into the ledger.
            </p>

            {/* Summary */}
            <div
              className="max-w-sm mx-auto bg-background p-6 rounded-lg border border-border text-left mb-8"
             
            >
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Vendor
                  </dt>
                  <dd className="font-medium text-foreground">
                    {savedExpense.vendor}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Amount
                  </dt>
                  <dd className="font-medium text-foreground">
                    {formatCurrency(savedExpense.amount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Date
                  </dt>
                  <dd className="font-medium text-foreground">
                    {savedExpense.date}
                  </dd>
                </div>
                <div
                  className="flex justify-between pt-3 border-t border-border"
                 
                >
                  <dt className="text-muted-foreground">
                    {savedExpense.assignmentType === "event"
                      ? "Event"
                      : "Category"}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {savedExpense.assignmentName}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Action Buttons */}
            <div
              className="flex items-center justify-center gap-4"
             
            >
              <Button
                variant="secondary"
                onClick={handleStartOver}
               
              >
                Import Another
              </Button>
              <Button
                variant="primary"
                onClick={() => router.push("/expenses")}
               
              >
                View Expenses
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div
        className="text-center py-6 mt-8 border-t border-border"
       
      >
        <p className="text-xs text-muted-foreground/60 italic">
          &ldquo;Keep a faithful record of thy receipts and
          disbursements.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
