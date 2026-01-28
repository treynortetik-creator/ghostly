'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  ArrowLeft,
  Upload,
  Sparkles,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  FileUpload,
  TransactionReview,
  ImportConfirmation,
  type ParsedTransaction,
  type AssignmentOption,
} from '@/components/import';

/* ============================================
   BREX CSV IMPORT PAGE
   ============================================
   Multi-step import flow:
   1. Upload CSV file
   2. Review transactions with AI suggestions
   3. Confirm and import
   Victorian theme: "The Receiving Office"
   ============================================ */

type ImportStep = 'upload' | 'review' | 'confirm' | 'complete';

interface ImportMeta {
  total: number;
  duplicates: number;
  withSuggestions: number;
  fileName: string;
}

interface ImportResult {
  success: boolean;
  summary: {
    total: number;
    created: number;
    replaced: number;
    errors: number;
    totalAmount: number;
  };
}

export default function BrexImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [assignmentOptions, setAssignmentOptions] = useState<AssignmentOption[]>([]);
  const [meta, setMeta] = useState<ImportMeta | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Handle file upload
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/brex', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process CSV file');
      }

      const data = await response.json();

      // Transform API response to component format
      const parsedTransactions: ParsedTransaction[] = data.transactions.map(
        (t: {
          id: string;
          date: string;
          amount: number;
          vendor: string;
          memo: string | null;
          suggestedAssignment: AssignmentOption | null;
          aiConfidence: number | null;
          isDuplicate: boolean;
          duplicateOf?: {
            id: string;
            date: string;
            vendor: string;
            amount: number;
          };
        }) => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          vendor: t.vendor,
          memo: t.memo,
          suggestedAssignment: t.suggestedAssignment,
          aiConfidence: t.aiConfidence,
          isDuplicate: t.isDuplicate,
          duplicateOf: t.duplicateOf,
          status: 'pending' as const,
        })
      );

      setTransactions(parsedTransactions);
      setAssignmentOptions(data.assignmentOptions);
      setMeta(data.meta);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update a single transaction
  const handleUpdateTransaction = useCallback(
    (id: string, updates: Partial<ParsedTransaction>) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  // Accept all suggestions
  const handleAcceptAll = useCallback(() => {
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        status: t.suggestedAssignment ? 'accepted' : t.status,
      }))
    );
  }, []);

  // Skip all duplicates
  const handleSkipDuplicates = useCallback(() => {
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        status: t.isDuplicate ? 'skipped' : t.status,
      }))
    );
  }, []);

  // Proceed to confirmation
  const handleProceedToConfirm = useCallback(() => {
    setStep('confirm');
  }, []);

  // Go back to review
  const handleBackToReview = useCallback(() => {
    setStep('review');
  }, []);

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Prepare transactions for import (only accepted and replace)
      const toImport = transactions
        .filter((t) => t.status === 'accepted' || t.status === 'replace')
        .filter((t) => t.suggestedAssignment) // Must have assignment
        .map((t) => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          vendor: t.vendor,
          memo: t.memo,
          assignmentId: t.suggestedAssignment!.id,
          assignmentType: t.suggestedAssignment!.type,
          status: t.status,
          replaceExpenseId: t.status === 'replace' ? t.duplicateOf?.id : undefined,
        }));

      if (toImport.length === 0) {
        throw new Error('No transactions to import');
      }

      const response = await fetch('/api/import/brex/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: toImport }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import transactions');
      }

      const result = await response.json();
      setImportResult(result);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm import');
    } finally {
      setIsLoading(false);
    }
  }, [transactions]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
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
          <CreditCard className="w-8 h-8 text-ink-gold" />
          Brex CSV Import
        </h1>
        <p className="mt-1 text-sepia">
          Import credit card transactions with AI-assisted categorization
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-xl">
          {['upload', 'review', 'confirm', 'complete'].map((s, index) => {
            const isActive = s === step;
            const isPast =
              ['upload', 'review', 'confirm', 'complete'].indexOf(step) > index;

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
                {index < 3 && (
                  <div
                    className={`
                      w-12 sm:w-24 h-0.5 mx-2
                      ${isPast ? 'bg-ink-green' : 'bg-wood-medium/20'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between max-w-xl mt-2 text-xs text-sepia">
          <span>Upload</span>
          <span>Review</span>
          <span>Confirm</span>
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
              Upload Brex Export
            </CardTitle>
            <CardDescription>
              Upload your Brex CSV export file to begin the import process.
              Transactions will be analyzed by AI for automatic categorization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFileSelect={handleFileSelect}
              accept=".csv"
              maxSizeMB={10}
              isLoading={isLoading}
              error={error}
            />

            {/* AI Feature Note */}
            <div className="mt-6 flex items-start gap-3 p-4 bg-ink-gold/10 border border-ink-gold/30 rounded-lg">
              <Sparkles className="w-5 h-5 text-ink-gold shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-ink-gold">AI-Powered Suggestions</p>
                <p className="text-sm text-sepia mt-1">
                  Our AI assistant will analyze each transaction and suggest the most
                  appropriate event or budget category based on vendor names and memos.
                  You&apos;ll have the chance to review and modify all suggestions before
                  importing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          {/* Meta Info */}
          {meta && (
            <div className="flex items-center gap-4 text-sm text-sepia">
              <span>
                File: <strong className="text-ink-black">{meta.fileName}</strong>
              </span>
              <span className="text-wood-medium/50">|</span>
              <span>
                {meta.total} transaction{meta.total !== 1 && 's'}
              </span>
              {meta.withSuggestions > 0 && (
                <>
                  <span className="text-wood-medium/50">|</span>
                  <span className="flex items-center gap-1 text-ink-gold">
                    <Sparkles className="w-3 h-3" />
                    {meta.withSuggestions} AI suggestions
                  </span>
                </>
              )}
              {meta.duplicates > 0 && (
                <>
                  <span className="text-wood-medium/50">|</span>
                  <span className="text-ink-red">{meta.duplicates} potential duplicates</span>
                </>
              )}
            </div>
          )}

          {/* Transaction Review */}
          <TransactionReview
            transactions={transactions}
            assignmentOptions={assignmentOptions}
            onUpdateTransaction={handleUpdateTransaction}
            onAcceptAll={handleAcceptAll}
            onSkipDuplicates={handleSkipDuplicates}
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-wood-medium/20">
            <Button
              variant="secondary"
              onClick={() => {
                setStep('upload');
                setTransactions([]);
                setMeta(null);
                setError(null);
              }}
            >
              Start Over
            </Button>
            <Button variant="primary" onClick={handleProceedToConfirm}>
              Continue to Confirm
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <ImportConfirmation
          transactions={transactions}
          onConfirm={handleConfirmImport}
          onBack={handleBackToReview}
          isLoading={isLoading}
        />
      )}

      {step === 'complete' && importResult && (
        <Card elevated>
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ink-green/20 mb-6">
              <CheckCircle className="w-8 h-8 text-ink-green" />
            </div>

            <h2 className="text-2xl font-serif font-bold text-wood-dark mb-2">
              Import Complete!
            </h2>
            <p className="text-sepia mb-8">
              Your Brex transactions have been successfully imported into the ledger.
            </p>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-8">
              <div className="bg-parchment p-4 rounded-lg border border-wood-medium/20">
                <p className="text-2xl font-serif font-bold text-ink-green">
                  {importResult.summary.created}
                </p>
                <p className="text-xs text-sepia">Created</p>
              </div>
              <div className="bg-parchment p-4 rounded-lg border border-wood-medium/20">
                <p className="text-2xl font-serif font-bold text-ink-gold">
                  {importResult.summary.replaced}
                </p>
                <p className="text-xs text-sepia">Replaced</p>
              </div>
              <div className="bg-parchment p-4 rounded-lg border border-wood-medium/20">
                <p className="text-2xl font-serif font-bold text-ink-black">
                  {importResult.summary.total}
                </p>
                <p className="text-xs text-sepia">Total</p>
              </div>
              <div className="bg-parchment p-4 rounded-lg border border-wood-medium/20">
                <p className="text-2xl font-serif font-bold text-ink-black">
                  {formatCurrency(importResult.summary.totalAmount)}
                </p>
                <p className="text-xs text-sepia">Amount</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setStep('upload');
                  setTransactions([]);
                  setMeta(null);
                  setImportResult(null);
                  setError(null);
                }}
              >
                Import More
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
          &ldquo;Every farthing has its place, and every place its farthing.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
