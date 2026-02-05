/**
 * The Counting House - PDF Invoice Import API
 *
 * POST /api/import/pdf
 * Upload and parse PDF invoice, extract vendor/amount/date using best-effort regex
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-logger';
import { createClient } from '@/lib/supabase/server';
import {
  chatCompletion,
  getCustomPrompt,
  buildPdfExtractionPrompt,
  type AssignmentTarget,
} from '@/lib/openrouter';

// Dynamic import pdf-parse at runtime to avoid build-time issues
// with canvas/DOMMatrix dependencies
interface PDFParseResult {
  text: string;
  numpages: number;
  info: Record<string, unknown>;
}

async function parsePDF(buffer: Buffer): Promise<PDFParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  return pdfParse(buffer);
}

// ============================================
// TYPES
// ============================================

interface ExtractedPDFData {
  vendor: string | null;
  amount: number | null;
  date: string | null;
  rawText: string;
  confidence: {
    vendor: 'high' | 'medium' | 'low' | 'none';
    amount: 'high' | 'medium' | 'low' | 'none';
    date: 'high' | 'medium' | 'low' | 'none';
  };
}

interface AiExtractionResult {
  vendor: string;
  amount: number;
  date: string;
  confidence: {
    vendor: 'high' | 'medium' | 'low';
    amount: 'high' | 'medium' | 'low';
    date: 'high' | 'medium' | 'low';
  };
  suggestedAssignment: {
    id: string | null;
    type: 'event' | 'category' | null;
    name: string | null;
    confidence: number;
  };
  reasoning: string;
}

// ============================================
// EXTRACTION HELPERS
// ============================================

/**
 * Extract amount from PDF text using various patterns
 * Looks for currency patterns like $X,XXX.XX
 */
function extractAmount(text: string): { value: number | null; confidence: 'high' | 'medium' | 'low' | 'none' } {
  // Priority patterns for amount extraction
  const patterns = [
    // Total/Amount Due patterns (highest confidence)
    /(?:total|amount\s*due|balance\s*due|grand\s*total|invoice\s*total)[\s:]*\$?([\d,]+\.?\d{0,2})/gi,
    // Subtotal patterns (medium-high confidence)
    /(?:subtotal|sub-total)[\s:]*\$?([\d,]+\.?\d{0,2})/gi,
    // General dollar amounts (medium confidence)
    /\$([\d,]+\.\d{2})/g,
    // Numbers that look like currency without $ sign
    /(?:USD|usd)[\s:]*\$?([\d,]+\.?\d{0,2})/gi,
  ];

  // Try each pattern in order of confidence
  for (let i = 0; i < patterns.length; i++) {
    const matches = text.matchAll(patterns[i]);
    const amounts: number[] = [];

    for (const match of matches) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        amounts.push(amount);
      }
    }

    if (amounts.length > 0) {
      // For total patterns, take the largest amount
      // For general patterns, take the most frequently appearing or largest
      const maxAmount = Math.max(...amounts);

      const confidence: 'high' | 'medium' | 'low' = i === 0 ? 'high' : i === 1 ? 'medium' : 'low';

      return { value: maxAmount, confidence };
    }
  }

  return { value: null, confidence: 'none' };
}

/**
 * Extract date from PDF text using various patterns
 */
function extractDate(text: string): { value: string | null; confidence: 'high' | 'medium' | 'low' | 'none' } {
  // Priority patterns for date extraction
  const datePatterns: { pattern: RegExp; confidence: 'high' | 'medium' | 'low'; parser: (match: RegExpMatchArray) => string | null }[] = [
    // Invoice date pattern (highest confidence)
    {
      pattern: /(?:invoice\s*date|date\s*of\s*invoice|bill\s*date)[\s:]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/gi,
      confidence: 'high',
      parser: (match) => parseMMDDYYYY(match[1], match[2], match[3]),
    },
    {
      pattern: /(?:invoice\s*date|date\s*of\s*invoice|bill\s*date)[\s:]*([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/gi,
      confidence: 'high',
      parser: (match) => parseMonthDDYYYY(match[1], match[2], match[3]),
    },
    // Due date pattern (medium-high confidence)
    {
      pattern: /(?:due\s*date|payment\s*due)[\s:]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/gi,
      confidence: 'medium',
      parser: (match) => parseMMDDYYYY(match[1], match[2], match[3]),
    },
    // General date patterns (medium confidence)
    {
      pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,
      confidence: 'medium',
      parser: (match) => parseMMDDYYYY(match[1], match[2], match[3]),
    },
    {
      pattern: /([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/g,
      confidence: 'medium',
      parser: (match) => parseMonthDDYYYY(match[1], match[2], match[3]),
    },
    // ISO format (medium confidence)
    {
      pattern: /(\d{4})-(\d{2})-(\d{2})/g,
      confidence: 'medium',
      parser: (match) => `${match[1]}-${match[2]}-${match[3]}`,
    },
  ];

  for (const { pattern, confidence, parser } of datePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const parsedDate = parser(match);
      if (parsedDate) {
        return { value: parsedDate, confidence };
      }
    }
  }

  return { value: null, confidence: 'none' };
}

/**
 * Parse MM/DD/YYYY or MM-DD-YYYY format to YYYY-MM-DD
 */
function parseMMDDYYYY(month: string, day: string, year: string): string | null {
  let yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);

  // Handle 2-digit year
  if (yearNum < 100) {
    yearNum = yearNum > 50 ? 1900 + yearNum : 2000 + yearNum;
  }

  // Validate
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return null;
  }

  return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
}

/**
 * Parse Month DD, YYYY format to YYYY-MM-DD
 */
function parseMonthDDYYYY(monthName: string, day: string, year: string): string | null {
  const months: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };

  const monthNum = months[monthName.toLowerCase()];
  if (!monthNum) return null;

  const yearNum = parseInt(year, 10);
  const dayNum = parseInt(day, 10);

  if (isNaN(yearNum) || isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
    return null;
  }

  return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
}

/**
 * Extract vendor/company name from PDF text
 */
function extractVendor(text: string): { value: string | null; confidence: 'high' | 'medium' | 'low' | 'none' } {
  // Clean and split text into lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Patterns for identifying vendor
  const billFromPatterns = [
    /(?:from|bill\s*from|invoice\s*from|sold\s*by|vendor|company)[\s:]+(.+)/i,
    /(?:remit\s*to|pay\s*to)[\s:]+(.+)/i,
  ];

  // Try "Bill From" style patterns
  for (const line of lines) {
    for (const pattern of billFromPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const vendor = match[1].trim();
        if (vendor.length >= 2 && vendor.length <= 100) {
          return { value: vendor, confidence: 'high' };
        }
      }
    }
  }

  // Try first non-empty line that looks like a company name
  // Skip lines that look like addresses, dates, or numbers
  const skipPatterns = [
    /^\d+\s/, // Starts with number
    /^invoice/i,
    /^date/i,
    /^page/i,
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // Date
    /^(?:total|amount|balance|due)/i,
    /^(?:bill\s*to|ship\s*to|sold\s*to)/i,
    /^(?:p\.?o\.?\s*box|suite|floor|apt)/i,
    /^(?:phone|fax|email|tel|www|http)/i,
  ];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];

    // Skip if matches any skip pattern
    if (skipPatterns.some(p => p.test(line))) {
      continue;
    }

    // Skip if too short or too long
    if (line.length < 3 || line.length > 100) {
      continue;
    }

    // Skip if mostly numbers
    const nonDigits = line.replace(/\d/g, '');
    if (nonDigits.length < line.length * 0.5) {
      continue;
    }

    // This might be a vendor name
    return { value: line, confidence: 'medium' };
  }

  return { value: null, confidence: 'none' };
}

/**
 * Extract all data from PDF text
 */
function extractDataFromText(text: string): ExtractedPDFData {
  const amountResult = extractAmount(text);
  const dateResult = extractDate(text);
  const vendorResult = extractVendor(text);

  return {
    vendor: vendorResult.value,
    amount: amountResult.value,
    date: dateResult.value,
    rawText: text.substring(0, 2000), // Limit raw text for response
    confidence: {
      vendor: vendorResult.confidence,
      amount: amountResult.confidence,
      date: dateResult.confidence,
    },
  };
}

// ============================================
// API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF file' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    let pdfData;
    try {
      pdfData = await parsePDF(buffer);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('PDF parse error:', errMsg, error);
      return NextResponse.json(
        { error: `Failed to parse PDF: ${errMsg}` },
        { status: 400 }
      );
    }

    // Extract text
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from PDF. The file may be image-based or empty.' },
        { status: 400 }
      );
    }

    // Extract data (regex fallback)
    const extractedData = extractDataFromText(text);

    // Try AI extraction
    let aiExtraction: AiExtractionResult | null = null;

    if (process.env.OPENROUTER_API_KEY) {
      try {
        const supabase = await createClient();

        // Fetch events and categories for assignment context
        const [{ data: events }, { data: categories }] = await Promise.all([
          supabase.from('events').select('id, name, event_type_id, quarter, event_types(name)').is('deleted_at', null),
          supabase.from('budget_categories').select('id, name, description').is('deleted_at', null),
        ]);

        const targets: AssignmentTarget[] = [
          ...(events || []).map(e => {
            // Handle joined event_types - can be object or array depending on Supabase version
            // Use unknown cast first to handle type system before migration is applied
            const eventTypeData = e.event_types as unknown;
            let eventTypeName: string | undefined;
            if (Array.isArray(eventTypeData)) {
              eventTypeName = (eventTypeData[0] as { name?: string } | undefined)?.name;
            } else if (eventTypeData && typeof eventTypeData === 'object') {
              eventTypeName = (eventTypeData as { name?: string }).name;
            }
            return {
              id: e.id, name: e.name, type: 'event' as const,
              eventType: eventTypeName || undefined, quarter: e.quarter || undefined,
            };
          }),
          ...(categories || []).map(c => ({
            id: c.id, name: c.name, type: 'category' as const,
            description: c.description || undefined,
          })),
        ];

        // Get custom prompt if any
        const customPrompt = await getCustomPrompt('prompt_pdf_extraction', supabase);
        const systemPrompt = buildPdfExtractionPrompt(targets, customPrompt || undefined);

        // Get the model setting
        const { data: configRow } = await supabase
          .from('app_settings').select('value').eq('key', 'app_config').single();
        const model = (configRow?.value as Record<string, unknown>)?.openrouter_model as string || 'anthropic/claude-3-haiku';

        const response = await chatCompletion(model, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract data from this invoice text:\n\n${text.substring(0, 4000)}` },
        ]);

        // Clean up response (remove markdown if present)
        let content = response.content.trim();
        if (content.startsWith('```json')) content = content.slice(7);
        if (content.startsWith('```')) content = content.slice(3);
        if (content.endsWith('```')) content = content.slice(0, -3);
        content = content.trim();

        const parsed = JSON.parse(content);
        aiExtraction = parsed as AiExtractionResult;
      } catch (err) {
        console.error('AI extraction failed, falling back to regex:', err);
        // Continue with regex fallback
      }
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      pageCount: pdfData.numpages,
      extracted: aiExtraction ? {
        vendor: aiExtraction.vendor,
        amount: aiExtraction.amount,
        date: aiExtraction.date,
        rawText: text.substring(0, 2000),
        confidence: aiExtraction.confidence,
      } : extractedData,
      suggestedAssignment: aiExtraction?.suggestedAssignment || null,
      aiPowered: !!aiExtraction,
    });
  } catch (err) {
    console.error('PDF import error:', err);
    logError('PDF import failed', { error: err as Error, source: 'import/pdf' });
    return NextResponse.json(
      { error: 'Failed to process PDF file' },
      { status: 500 }
    );
  }
}
