/**
 * Slack Request Verification
 *
 * Verifies incoming requests from Slack using the signing secret.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */

import { createHmac, timingSafeEqual } from 'crypto';

const SLACK_VERSION = 'v0';
const MAX_TIMESTAMP_DIFF_SECONDS = 300; // 5 minutes

/**
 * Verify a Slack request signature.
 * Returns true if the request is authentic, false otherwise.
 */
export function verifySlackRequest(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Reject if timestamp is too old (replay attack prevention)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_DIFF_SECONDS) {
    return false;
  }

  // Compute expected signature
  const baseString = `${SLACK_VERSION}:${timestamp}:${body}`;
  const expectedSignature =
    `${SLACK_VERSION}=` +
    createHmac('sha256', signingSecret).update(baseString).digest('hex');

  // Constant-time comparison
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Extract and verify a Slack request from a NextRequest.
 * Returns the raw body string if verified, or null if verification fails.
 */
export async function verifySlackNextRequest(
  request: Request
): Promise<{ verified: boolean; body: string }> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET not configured');
    return { verified: false, body: '' };
  }

  const signature = request.headers.get('x-slack-signature') || '';
  const timestamp = request.headers.get('x-slack-request-timestamp') || '';
  const body = await request.text();

  const verified = verifySlackRequest(signingSecret, signature, timestamp, body);
  return { verified, body };
}
