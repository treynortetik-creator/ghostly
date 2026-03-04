import path from 'path';

export function getUploadBasePath(): string {
  return path.resolve(process.cwd(), process.env.DOCUMENT_UPLOAD_DIR || 'uploads');
}
