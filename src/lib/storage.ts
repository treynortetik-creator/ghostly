/**
 * Ghostly - Supabase Storage Helper
 *
 * Provides upload, download, and delete operations for the 'documents'
 * bucket in Supabase Storage. Replaces local filesystem storage so
 * files persist across Railway deploys.
 */

import { createClient } from '@/lib/supabase/server';

const BUCKET_NAME = 'documents';

/**
 * Upload a document to Supabase Storage.
 *
 * @param orgId - Organization ID (used as a path prefix for isolation)
 * @param docId - Unique document identifier
 * @param buffer - File contents
 * @param mimeType - MIME type of the file
 * @param fileName - Filename including extension (e.g. "uuid.pdf")
 * @returns The storage path within the bucket
 */
export async function uploadDocument(
  orgId: string,
  docId: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const supabase = createClient();
  const storagePath = `${orgId}/${docId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

/**
 * Download a document from Supabase Storage.
 *
 * @param storagePath - The path returned by uploadDocument
 * @returns The file as a Blob
 */
export async function downloadDocument(storagePath: string): Promise<Blob> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return data;
}

/**
 * Delete one or more documents from Supabase Storage.
 *
 * @param storagePaths - One or more paths to delete
 */
export async function deleteDocument(storagePaths: string | string[]): Promise<void> {
  const supabase = createClient();
  const paths = Array.isArray(storagePaths) ? storagePaths : [storagePaths];

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(paths);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
