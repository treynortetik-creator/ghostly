/**
 * Slack OAuth Helpers
 *
 * Handles state JWT creation/verification for CSRF protection.
 */

import { SignJWT, jwtVerify } from 'jose';

const STATE_EXPIRY = '10m';

/**
 * Create a signed state JWT for the OAuth flow.
 */
export async function createOAuthState(orgId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
  return new SignJWT({ orgId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STATE_EXPIRY)
    .setIssuer('ghostly-slack-oauth')
    .sign(secret);
}

/**
 * Verify and decode the OAuth state JWT. Returns the orgId or null.
 */
export async function verifyOAuthState(state: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(state, secret, {
      issuer: 'ghostly-slack-oauth',
    });
    return (payload.orgId as string) || null;
  } catch {
    return null;
  }
}

/**
 * Build the Slack OAuth authorization URL.
 */
export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error('SLACK_CLIENT_ID not configured');

  const scopes = [
    'chat:write',
    'chat:write.public',
    'commands',
    'app_mentions:read',
    'im:history',
    'im:write',
    'channels:read',
    'users:read',
    'files:write',
  ].join(',');

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
