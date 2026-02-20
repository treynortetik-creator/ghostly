/**
 * Shared constants for The Counting House
 */

/** Maximum file upload size in bytes (configurable via DOCUMENT_MAX_SIZE_MB env var) */
export const MAX_FILE_SIZE_BYTES = (parseInt(process.env.DOCUMENT_MAX_SIZE_MB || '10', 10)) * 1024 * 1024;

/** Human-readable max file size string */
export const MAX_FILE_SIZE_LABEL = `${process.env.DOCUMENT_MAX_SIZE_MB || '10'} MB`;
