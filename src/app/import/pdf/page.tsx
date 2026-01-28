'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  Save,
} from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PDFUpload, PDFPreview, AssignmentSelector } from '@/components/import';
import type { ExtractedData, EditableExpenseData } from '@/components/import/PDFPreview';
import type { AssignmentOption } from '@/components/import/AssignmentSelector';

/* ============================================
   PDF INVOICE IMPORT PAGE
   ============================================
   Import flow:
   1. Upload PDF file
   2. Review/edit extracted data (vendor, amount, date)
   3. Select event or category assignment
   4. Confirm and save expense
   Victorian theme: "The Invoice Archive"
   ============================================ */

type ImportStep = 'upload' | 'review' | 'complete';

interface ParsedPDFResult {
  fileName: string;
  pageCount: number;
  extracted: ExtractedData;
}

interface SavedExpense {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  assignmentName: string;
  assignmentType: 'event' | 'category';
}

export default function PDFImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed data
  const [pdfResult, setPdfResult] = useState<ParsedPDFResult | null>(null);
  const [editableData, setEditableData] = useState<EditableExpenseData>({
    vendor: '',
    amount: null,
    date: '',
  });
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentOption | null>(null);
  const [assignmentOptions, setAssignmentOptions] = useState<AssignmentOption[]>([]);
  const [savedExpense, setSavedExpense] = useState<SavedExpense | null>(null);

  // Load assignment options (events and categories)
  useEffect(() => {
    const loadOptions = async () => {
      try {
        // Fetch events
        const eventsRes = await fetch('/api/events');
        const eventsData = await eventsRes.json();

        // Fetch categories
        const categoriesRes = await fetch('/api/categories');
        const categoriesData = await categoriesRes.json();

        const options: AssignmentOption[] = [
          ...(eventsData.events || []).map((e: { id: string; name: string; event_type?: string; quarter?: string }) => ({
            id: e.id,
            name: e.name,
            type: 'event' as const,
            eventType: e.event_type,
            quarter: e.quarter,
          })),
          ...(categoriesData.categories || []).map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
            type: 'category' as const,
          })),
        ];

        setAssignmentOptions(options);
      } catch (err) {
        console.error('Failed to load assignment options:', err);
        // Don't show error - options will be empty but user can still proceed
      }
    };

    loadOptions();
  }, []);

  // Handle file upload
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process PDF file');
      }

      const data = await response.json();

      setPdfResult({
        fileName: data.fileName,
        pageCount: data.pageCount,
        extracted: data.extracted,
      });

      // Initialize editable data
      setEditableData({
        vendor: data.extracted.vendor || '',
        amount: data.extracted.amount,
        date: data.extracted.date || '',
      });

      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle data changes from preview
  const handleDataChange = useCallback((data: EditableExpenseData) => {
    setEditableData(data);
  }, []);

  // Validate before save
  const validateExpense = (): string | null => {
    if (!editableData.vendor.trim()) {
      return 'Vendor name is required';
    }
    if (!editableData.amount || editableData.amount <= 0) {
      return 'Valid amount is required';
    }
    if (!editableData.date) {
      return 'Expense date is required';
    }
    if (!selectedAssignment) {
      return 'Please select an event or category';
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
        source_type: 'pdf',
        source_reference: pdfResult?.fileName,
        ...(selectedAssignment?.type === 'event'
          ? { event_id: selectedAssignment.id }
          : { category_id: selectedAssignment?.id }),
      };

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save expense');
      }

      const savedData = await response.json();

      setSavedExpense({
        id: savedData.id || savedData.expense?.id || 'exp-new',
        vendor: editableData.vendor,
        amount: editableData.amount!,
        date: editableData.date,
        assignmentName: selectedAssignment?.name || 'Unknown',
        assignmentType: selectedAssignment?.type || 'category',
      });

      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setIsLoading(false);
    }
  }, [editableData, selectedAssignment, pdfResult]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Reset form
  const handleStartOver = () => {
    setStep('upload');
    setPdfResult(null);
    setEditableData({ vendor: '', amount: null, date: '' });
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
          className="inline-flex items-center gap-1 text-sm text-sepia hover:text-wood-dark transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Import Hub
        </Link>

        <h1 className="text-3xl font-serif font-bold text-wood-dark flex items-center gap-3">
          <FileText className="w-8 h-8 text-ink-gold" />
          PDF Invoice Import
        </h1>
        <p className="mt-1 text-sepia">
          Extract expense details from PDF invoices and receipts
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-md">
          {['upload', 'review', 'complete'].map((s, index) => {
            const isActive = s === step;
            const isPast =
              ['upload', 'review', 'complete'].indexOf(step) > index;

            return (
              <div key={s} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-200
                    ${
                      isActive
                        ? 'bg-ink-gold text-ink-black'
                        : isPast
                        ? 'bg-ink-green text-parchment'
                        : 'bg-wood-medium/20 text-sepia'
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
                      ${isPast ? 'bg-ink-green' : 'bg-wood-medium/20'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between max-w-md mt-2 text-xs text-sepia">
          <span>Upload</span>
          <span>Review</span>
          <span>Complete</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-ink-red/10 border border-ink-red/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-ink-red shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-ink-red">Error</p>
            <p className="text-sm text-ink-red/80">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-ink-gold" />
              Upload PDF Invoice
            </CardTitle>
            <CardDescription>
              Upload a PDF invoice or receipt to extract expense details.
              The system will attempt to identify the vendor, amount, and date.
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
            <div className="mt-6 flex items-start gap-3 p-4 bg-sepia/10 border border-sepia/30 rounded-lg">
              <FileText className="w-5 h-5 text-sepia shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-wood-dark">Extraction Tips</p>
                <p className="text-sm text-sepia mt-1">
                  For best results, upload PDFs with selectable text (not scanned images).
                  The system looks for common invoice patterns to identify vendor names,
                  total amounts, and dates. You can always edit the extracted values
                  before saving.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'review' && pdfResult && (
        <div className="space-y-6">
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
              <CardTitle>Assign to Event or Category</CardTitle>
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
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-wood-medium/20">
            <Button variant="secondary" onClick={handleStartOver}>
              Start Over
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveExpense}
              disabled={isLoading}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isLoading ? 'Saving...' : 'Save Expense'}
            </Button>
          </div>
        </div>
      )}

      {step === 'complete' && savedExpense && (
        <Card elevated>
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ink-green/20 mb-6">
              <CheckCircle className="w-8 h-8 text-ink-green" />
            </div>

            <h2 className="text-2xl font-serif font-bold text-wood-dark mb-2">
              Expense Saved!
            </h2>
            <p className="text-sepia mb-8">
              Your invoice has been successfully imported into the ledger.
            </p>

            {/* Summary */}
            <div className="max-w-sm mx-auto bg-parchment p-6 rounded-lg border border-wood-medium/20 text-left mb-8">
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sepia">Vendor</dt>
                  <dd className="font-medium text-ink-black">{savedExpense.vendor}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sepia">Amount</dt>
                  <dd className="font-medium text-ink-black">{formatCurrency(savedExpense.amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sepia">Date</dt>
                  <dd className="font-medium text-ink-black">{savedExpense.date}</dd>
                </div>
                <div className="flex justify-between pt-3 border-t border-wood-medium/20">
                  <dt className="text-sepia">
                    {savedExpense.assignmentType === 'event' ? 'Event' : 'Category'}
                  </dt>
                  <dd className="font-medium text-ink-black">{savedExpense.assignmentName}</dd>
                </div>
              </dl>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Button variant="secondary" onClick={handleStartOver}>
                Import Another
              </Button>
              <Button variant="primary" onClick={() => router.push('/expenses')}>
                View Expenses
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center py-6 mt-8 border-t border-wood-medium/20">
        <p className="text-xs text-sepia/60 italic">
          &ldquo;Keep a faithful record of thy receipts and disbursements.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
