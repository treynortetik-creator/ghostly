"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  ArrowLeft,
  Upload,
  Sparkles,
  CheckCircle,
  AlertCircle,
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
import {
  FileUpload,
  TransactionReview,
  ImportConfirmation,
  type ParsedTransaction,
  type AssignmentOption,
} from "@/components/import";

/* ============================================
   BREX CSV IMPORT PAGE
   ============================================
   Multi-step import flow:
   1. Upload CSV file
   2. Review transactions with AI suggestions
   3. Confirm and import
   Victorian theme: "The Receiving Office"
   ============================================ */

type ImportStep = "upload" | "review" | "confirm" | "complete";

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
  const [step, setStep] = useState<ImportStep>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [assignmentOptions, setAssignmentOptions] = useState<
    AssignmentOption[]
  >([]);
  const [meta, setMeta] = useState<ImportMeta | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Handle file upload
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/brex", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process CSV file");
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
          status: "pending" as const,
        }),
      );

      setTransactions(parsedTransactions);
      setAssignmentOptions(data.assignmentOptions);
      setMeta(data.meta);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update a single transaction
  const handleUpdateTransaction = useCallback(
    (id: string, updates: Partial<ParsedTransaction>) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  // Accept all suggestions
  const handleAcceptAll = useCallback(() => {
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        status: t.suggestedAssignment ? "accepted" : t.status,
      })),
    );
  }, []);

  // Skip all duplicates
  const handleSkipDuplicates = useCallback(() => {
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        status: t.isDuplicate ? "skipped" : t.status,
      })),
    );
  }, []);

  // Proceed to confirmation
  const handleProceedToConfirm = useCallback(() => {
    setStep("confirm");
  }, []);

  // Go back to review
  const handleBackToReview = useCallback(() => {
    setStep("review");
  }, []);

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Prepare transactions for import (only accepted and replace)
      const toImport = transactions
        .filter((t) => t.status === "accepted" || t.status === "replace")
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
          replaceExpenseId:
            t.status === "replace" ? t.duplicateOf?.id : undefined,
        }));

      if (toImport.length === 0) {
        throw new Error("No transactions to import");
      }

      const response = await fetch("/api/import/brex/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: toImport }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import transactions");
      }

      const result = await response.json();
      setImportResult(result);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm import");
    } finally {
      setIsLoading(false);
    }
  }, [transactions]);

  return (
    <AppShell data-oid="wdtv3v2">
      {/* Page Header */}
      <div className="mb-8" data-oid="epcmj9a">
        <Link
          href="/import"
          className="inline-flex items-center gap-1 text-sm text-sepia hover:text-wood-dark transition-colors mb-4"
          data-oid="bporqfl"
        >
          <ArrowLeft className="w-4 h-4" data-oid="lyb484u" />
          Back to Import Hub
        </Link>

        <h1
          className="text-3xl font-serif font-bold text-wood-dark flex items-center gap-3"
          data-oid="24u2lzn"
        >
          <CreditCard className="w-8 h-8 text-ink-gold" data-oid="5hyre8u" />
          Brex CSV Import
        </h1>
        <p className="mt-1 text-sepia" data-oid="zx9u0nv">
          Import credit card transactions with AI-assisted categorization
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8" data-oid="h1.xybe">
        <div
          className="flex items-center justify-between max-w-xl"
          data-oid="gnol-fx"
        >
          {["upload", "review", "confirm", "complete"].map((s, index) => {
            const isActive = s === step;
            const isPast =
              ["upload", "review", "confirm", "complete"].indexOf(step) > index;

            return (
              <div key={s} className="flex items-center" data-oid="ksihvq8">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-ink-gold text-ink-black"
                        : isPast
                          ? "bg-ink-green text-parchment"
                          : "bg-wood-medium/20 text-sepia"
                    }
                  `}
                  data-oid="tbcjocj"
                >
                  {isPast ? (
                    <CheckCircle className="w-4 h-4" data-oid="5a2zv95" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 3 && (
                  <div
                    className={`
                      w-12 sm:w-24 h-0.5 mx-2
                      ${isPast ? "bg-ink-green" : "bg-wood-medium/20"}
                    `}
                    data-oid="52_tgdi"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div
          className="flex justify-between max-w-xl mt-2 text-xs text-sepia"
          data-oid=".jy2n4w"
        >
          <span data-oid="v3w0486">Upload</span>
          <span data-oid="a_mm40y">Review</span>
          <span data-oid="66kce.p">Confirm</span>
          <span data-oid="4rxhrj:">Complete</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          className="mb-6 flex items-start gap-3 p-4 bg-ink-red/10 border border-ink-red/30 rounded-lg"
          data-oid="azmjupq"
        >
          <AlertCircle
            className="w-5 h-5 text-ink-red shrink-0 mt-0.5"
            data-oid="l4qq65a"
          />
          <div data-oid="e.:_gjw">
            <p className="font-medium text-ink-red" data-oid="0ytd6jg">
              Error
            </p>
            <p className="text-sm text-ink-red/80" data-oid="jwi9-.6">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === "upload" && (
        <Card data-oid="8.jdet9">
          <CardHeader data-oid="1vqkykj">
            <CardTitle className="flex items-center gap-2" data-oid="puopfu7">
              <Upload className="w-5 h-5 text-ink-gold" data-oid="ts-nlej" />
              Upload Brex Export
            </CardTitle>
            <CardDescription data-oid="pf89v.:">
              Upload your Brex CSV export file to begin the import process.
              Transactions will be analyzed by AI for automatic categorization.
            </CardDescription>
          </CardHeader>
          <CardContent data-oid="a6th.tg">
            <FileUpload
              onFileSelect={handleFileSelect}
              accept=".csv"
              maxSizeMB={10}
              isLoading={isLoading}
              error={error}
              data-oid="3cb8hyo"
            />

            {/* AI Feature Note */}
            <div
              className="mt-6 flex items-start gap-3 p-4 bg-ink-gold/10 border border-ink-gold/30 rounded-lg"
              data-oid="6yg.29l"
            >
              <Sparkles
                className="w-5 h-5 text-ink-gold shrink-0 mt-0.5"
                data-oid="w:nyh2k"
              />
              <div data-oid="94sx4u:">
                <p className="font-medium text-ink-gold" data-oid="cncupyb">
                  AI-Powered Suggestions
                </p>
                <p className="text-sm text-sepia mt-1" data-oid="qrm8:mm">
                  Our AI assistant will analyze each transaction and suggest the
                  most appropriate event or budget category based on vendor
                  names and memos. You&apos;ll have the chance to review and
                  modify all suggestions before importing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <div className="space-y-6" data-oid="t.4h7ir">
          {/* Meta Info */}
          {meta && (
            <div
              className="flex items-center gap-4 text-sm text-sepia"
              data-oid="of_.szn"
            >
              <span data-oid="tjpoy56">
                File:{" "}
                <strong className="text-ink-black" data-oid="-.25543">
                  {meta.fileName}
                </strong>
              </span>
              <span className="text-wood-medium/50" data-oid="0rzn5vk">
                |
              </span>
              <span data-oid="nnytnch">
                {meta.total} transaction{meta.total !== 1 && "s"}
              </span>
              {meta.withSuggestions > 0 && (
                <>
                  <span className="text-wood-medium/50" data-oid="mz_efvu">
                    |
                  </span>
                  <span
                    className="flex items-center gap-1 text-ink-gold"
                    data-oid="8xdujhr"
                  >
                    <Sparkles className="w-3 h-3" data-oid="2u11:97" />
                    {meta.withSuggestions} AI suggestions
                  </span>
                </>
              )}
              {meta.duplicates > 0 && (
                <>
                  <span className="text-wood-medium/50" data-oid="rtckwu7">
                    |
                  </span>
                  <span className="text-ink-red" data-oid="eq95nfn">
                    {meta.duplicates} potential duplicates
                  </span>
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
            data-oid="p_f5ef4"
          />

          {/* Action Buttons */}
          <div
            className="flex items-center justify-end gap-4 pt-4 border-t border-wood-medium/20"
            data-oid="esuhz7w"
          >
            <Button
              variant="secondary"
              onClick={() => {
                setStep("upload");
                setTransactions([]);
                setMeta(null);
                setError(null);
              }}
              data-oid="pbixuzz"
            >
              Start Over
            </Button>
            <Button
              variant="primary"
              onClick={handleProceedToConfirm}
              data-oid="r1aba6m"
            >
              Continue to Confirm
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <ImportConfirmation
          transactions={transactions}
          onConfirm={handleConfirmImport}
          onBack={handleBackToReview}
          isLoading={isLoading}
          data-oid="yg0znjc"
        />
      )}

      {step === "complete" && importResult && (
        <Card elevated data-oid="loa:m4:">
          <CardContent className="py-12 text-center" data-oid="ldzlrqt">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ink-green/20 mb-6"
              data-oid="ro_.n9v"
            >
              <CheckCircle
                className="w-8 h-8 text-ink-green"
                data-oid="qqkq9q3"
              />
            </div>

            <h2
              className="text-2xl font-serif font-bold text-wood-dark mb-2"
              data-oid="874jxxm"
            >
              Import Complete!
            </h2>
            <p className="text-sepia mb-8" data-oid="673myr2">
              Your Brex transactions have been successfully imported into the
              ledger.
            </p>

            {/* Summary Stats */}
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-8"
              data-oid="sj:nisv"
            >
              <div
                className="bg-parchment p-4 rounded-lg border border-wood-medium/20"
                data-oid="hwrs:h4"
              >
                <p
                  className="text-2xl font-serif font-bold text-ink-green"
                  data-oid="vs6qx1p"
                >
                  {importResult.summary.created}
                </p>
                <p className="text-xs text-sepia" data-oid="6ss7cro">
                  Created
                </p>
              </div>
              <div
                className="bg-parchment p-4 rounded-lg border border-wood-medium/20"
                data-oid="xf::kmv"
              >
                <p
                  className="text-2xl font-serif font-bold text-ink-gold"
                  data-oid="05s44.r"
                >
                  {importResult.summary.replaced}
                </p>
                <p className="text-xs text-sepia" data-oid="ysat.58">
                  Replaced
                </p>
              </div>
              <div
                className="bg-parchment p-4 rounded-lg border border-wood-medium/20"
                data-oid="eh4kkr5"
              >
                <p
                  className="text-2xl font-serif font-bold text-ink-black"
                  data-oid="p33k5a7"
                >
                  {importResult.summary.total}
                </p>
                <p className="text-xs text-sepia" data-oid="x1wfnov">
                  Total
                </p>
              </div>
              <div
                className="bg-parchment p-4 rounded-lg border border-wood-medium/20"
                data-oid="-7p-2yc"
              >
                <p
                  className="text-2xl font-serif font-bold text-ink-black"
                  data-oid="_r3j7h2"
                >
                  {formatCurrency(importResult.summary.totalAmount)}
                </p>
                <p className="text-xs text-sepia" data-oid="mal-idb">
                  Amount
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div
              className="flex items-center justify-center gap-4"
              data-oid="5876t_0"
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setStep("upload");
                  setTransactions([]);
                  setMeta(null);
                  setImportResult(null);
                  setError(null);
                }}
                data-oid="yq3_.c7"
              >
                Import More
              </Button>
              <Button
                variant="primary"
                onClick={() => router.push("/expenses")}
                data-oid="w_uuzka"
              >
                View Expenses
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div
        className="text-center py-6 mt-8 border-t border-wood-medium/20"
        data-oid="aihz2p8"
      >
        <p className="text-xs text-sepia/60 italic" data-oid="evwdn42">
          &ldquo;Every farthing has its place, and every place its
          farthing.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
