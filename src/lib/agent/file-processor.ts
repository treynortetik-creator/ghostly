/**
 * Ghostly Agent - File Processing Utilities
 *
 * Extracts text content from uploaded files for use as context
 * in agent conversations. Supports text-based files, PDFs, DOCX,
 * XLSX, EML, and images (via vision API placeholder).
 */

import path from 'path';
import fs from 'fs/promises';
import { getUploadBasePath } from '@/lib/uploads';

const MAX_TEXT_LENGTH = 50000;

/**
 * Check if a MIME type is an image type
 */
export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Convert a buffer to a base64 data URL
 */
export function fileToBase64DataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Parse an EML (email) file and extract headers + body
 */
export function parseEml(content: string): string {
  const lines = content.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let headerEnd = 0;

  // Parse headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      headerEnd = i + 1;
      break;
    }
    const match = line.match(/^(From|To|Subject|Date|Cc):\s*(.*)$/i);
    if (match) {
      headers[match[1]] = match[2];
    }
  }

  // Extract body (everything after headers)
  const body = lines.slice(headerEnd).join('\n').trim();

  const parts: string[] = [];
  if (headers['From']) parts.push(`From: ${headers['From']}`);
  if (headers['To']) parts.push(`To: ${headers['To']}`);
  if (headers['Cc']) parts.push(`Cc: ${headers['Cc']}`);
  if (headers['Subject']) parts.push(`Subject: ${headers['Subject']}`);
  if (headers['Date']) parts.push(`Date: ${headers['Date']}`);
  if (parts.length > 0) parts.push('');
  parts.push(body);

  return parts.join('\n');
}

/**
 * Extract text from a PDF using simple regex on BT/ET text markers.
 * This is a lightweight extraction — not a full PDF parser.
 */
function extractPdfText(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  const textParts: string[] = [];

  // Find text between BT (Begin Text) and ET (End Text) markers
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(content)) !== null) {
    const block = match[1];
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(tjMatch[1]);
    }
    // Also extract from TJ arrays
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = tjArrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(inner)) !== null) {
        textParts.push(strMatch[1]);
      }
    }
  }

  return textParts.join(' ').trim() || '[PDF text could not be extracted]';
}

/**
 * Extract text from a DOCX file by parsing XML content from the ZIP.
 */
function extractDocxText(buffer: Buffer): string {
  // DOCX is a ZIP file — find document.xml inside it
  const content = buffer.toString('latin1');

  // Look for the word/document.xml entry and extract text from <w:t> tags
  const textParts: string[] = [];
  const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = wtRegex.exec(content)) !== null) {
    textParts.push(match[1]);
  }

  return textParts.join(' ').trim() || '[DOCX text could not be extracted]';
}

/**
 * Extract text from an XLSX file by parsing XML content from the ZIP.
 */
function extractXlsxText(buffer: Buffer): string {
  const content = buffer.toString('latin1');

  // Extract from shared strings and sheet data
  const textParts: string[] = [];

  // Shared strings: <t>...</t>
  const tRegex = /<t[^>]*>([^<]*)<\/t>/g;
  let match;
  while ((match = tRegex.exec(content)) !== null) {
    if (match[1].trim()) {
      textParts.push(match[1]);
    }
  }

  // Cell values: <v>...</v>
  const vRegex = /<v>([^<]*)<\/v>/g;
  while ((match = vRegex.exec(content)) !== null) {
    if (match[1].trim()) {
      textParts.push(match[1]);
    }
  }

  return textParts.join(' ').trim() || '[XLSX text could not be extracted]';
}

/**
 * Extract text content from a file based on its MIME type.
 * Images return a placeholder since they are handled via vision API.
 */
export async function extractTextFromFile(
  storagePath: string,
  mimeType: string,
): Promise<string> {
  // Resolve the full path from the storage path
  // storagePath format: "uploads/YYYY/MM/uuid.ext"
  const relativePath = storagePath.replace(/^uploads\//, '');
  const fullPath = path.join(getUploadBasePath(), relativePath);

  const buffer = await fs.readFile(fullPath);

  // Images are handled separately via vision API
  if (isImageType(mimeType)) {
    return '[Image file — handled via vision API]';
  }

  let text: string;

  switch (mimeType) {
    case 'application/pdf':
      text = extractPdfText(buffer);
      break;

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      text = extractDocxText(buffer);
      break;

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      text = extractXlsxText(buffer);
      break;

    case 'message/rfc822':
      text = parseEml(buffer.toString('utf-8'));
      break;

    // Text-based types: CSV, TXT, MD, JSON
    case 'text/csv':
    case 'text/plain':
    case 'text/markdown':
    case 'application/json':
      text = buffer.toString('utf-8');
      break;

    default:
      text = '[Unsupported file type for text extraction]';
  }

  // Limit text length
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH) + '\n... [truncated]';
  }

  return text;
}
