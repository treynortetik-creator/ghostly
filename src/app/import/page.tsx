'use client';

import Link from 'next/link';
import { Upload, FileText, CreditCard, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/* ============================================
   IMPORT HUB PAGE
   ============================================
   Central hub for all import methods:
   - Brex CSV import (with AI categorization)
   - PDF invoice import
   Victorian theme: "The Receiving Ledger"
   ============================================ */

interface ImportOption {
  title: string;
  description: string;
  details: string[];
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  available: boolean;
}

const importOptions: ImportOption[] = [
  {
    title: 'Brex Card Transactions',
    description: 'Import expenses from your Brex CSV export with AI-assisted categorization.',
    details: [
      'Upload CSV file exported from Brex',
      'AI suggests event or category for each transaction',
      'Review and confirm assignments before import',
      'Automatic duplicate detection',
    ],
    icon: CreditCard,
    href: '/import/brex',
    available: true,
  },
  {
    title: 'PDF Invoice Upload',
    description: 'Extract expense details from PDF invoices using text extraction.',
    details: [
      'Upload PDF invoices or receipts',
      'Automatic text extraction (vendor, amount, date)',
      'Review extracted data before saving',
      'Attach original PDF to expense record',
    ],
    icon: FileText,
    href: '/import/pdf',
    available: false, // Coming in Phase 5.2
  },
];

export default function ImportHubPage() {
  return (
    <AppShell>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-wood-dark flex items-center gap-3">
          <Upload className="w-8 h-8 text-ink-gold" />
          The Receiving Ledger
        </h1>
        <p className="mt-1 text-sepia">
          Import expenses from external sources into your ledger
        </p>
      </div>

      {/* Import Options Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {importOptions.map((option) => {
          const Icon = option.icon;

          return (
            <Card
              key={option.title}
              elevated
              className={`relative ${!option.available ? 'opacity-60' : ''}`}
            >
              {/* Coming Soon Badge */}
              {!option.available && (
                <div className="absolute top-4 right-4">
                  <span className="px-2 py-1 text-xs font-medium bg-sepia/15 text-sepia rounded border border-sepia/30">
                    Coming Soon
                  </span>
                </div>
              )}

              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-wood-medium/10 border border-wood-medium/20">
                    <Icon className="w-6 h-6 text-ink-gold" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>{option.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {option.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Feature List */}
                <ul className="space-y-2 mb-6">
                  {option.details.map((detail, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-sepia">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-ink-gold/60 shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                {option.available ? (
                  <Link href={option.href}>
                    <Button
                      variant="primary"
                      className="w-full"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Begin Import
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full"
                    disabled
                  >
                    Available Soon
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help Section */}
      <Card className="mt-8">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-ink-green/10 border border-ink-green/20">
              <FileSpreadsheet className="w-5 h-5 text-ink-green" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-wood-dark">
                Brex CSV Format
              </h3>
              <p className="mt-1 text-sm text-sepia">
                Export your transactions from Brex using their &ldquo;Export to CSV&rdquo; feature.
                The expected columns are: Transaction date, Amount, Merchant, and Memo.
              </p>
              <p className="mt-2 text-xs text-sepia/70 font-mono bg-parchment px-3 py-2 rounded border border-wood-medium/20">
                Transaction date, Amount, Original amount, Original currency, Merchant, Memo, Expense status, Payment status
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-6 mt-8 border-t border-wood-medium/20">
        <p className="text-xs text-sepia/60 italic">
          &ldquo;A penny saved is a penny earned, but a penny tracked is wisdom discerned.&rdquo;
        </p>
      </div>
    </AppShell>
  );
}
