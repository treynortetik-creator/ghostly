/**
 * Next.js Instrumentation Hook
 *
 * Runs once on server startup. Used for environment validation
 * and other one-time initialization tasks.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server (Node.js runtime), not in Edge
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvVars } = await import('@/lib/env-validation');
    validateEnvVars();
  }
}
