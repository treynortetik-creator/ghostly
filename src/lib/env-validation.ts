/**
 * Environment Variable Validation
 *
 * Validates required and optional env vars on startup.
 * Logs warnings but never throws — allows the app to start for debugging.
 */

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'AUTH_USERNAME',
  'AUTH_PASSWORD',
] as const;

const OPTIONAL_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OPENROUTER_API_KEY',
  'DOCUMENT_UPLOAD_DIR',
  'DOCUMENT_MAX_SIZE_MB',
] as const;

let hasRun = false;

export function validateEnvVars(): void {
  // Only run once per process
  if (hasRun) return;
  hasRun = true;

  console.log('[Ghostly] Validating environment variables...');

  // Check required vars
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(
      `[Ghostly] Missing required environment variables: ${missing.join(', ')}. ` +
      'The application may not function correctly.'
    );
  }

  // Check optional vars and log which are configured
  const configuredOptional = OPTIONAL_ENV_VARS.filter(v => !!process.env[v]);
  const missingOptional = OPTIONAL_ENV_VARS.filter(v => !process.env[v]);

  if (missingOptional.length > 0) {
    console.info(
      `[Ghostly] Optional environment variables not set: ${missingOptional.join(', ')}`
    );
  }

  // Validate formats
  if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
    console.warn('[Ghostly] SUPABASE_URL should start with https://');
  }

  if (process.env.DOCUMENT_MAX_SIZE_MB) {
    const maxSize = parseInt(process.env.DOCUMENT_MAX_SIZE_MB, 10);
    if (isNaN(maxSize) || maxSize <= 0) {
      console.warn('[Ghostly] DOCUMENT_MAX_SIZE_MB must be a positive integer');
    }
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('[Ghostly] JWT_SECRET should be at least 32 characters for security');
  }

  if (missing.length === 0) {
    console.log(
      `[Ghostly] Environment validation passed. ` +
      `${REQUIRED_ENV_VARS.length} required vars OK, ` +
      `${configuredOptional.length}/${OPTIONAL_ENV_VARS.length} optional vars configured.`
    );
  }
}
