/**
 * GET /api/integrations/slack/oauth/authorize
 *
 * Redirects the user to Slack's OAuth consent page.
 * Requires authentication (user must be logged in).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrgId } from '@/lib/api-helpers';
import { requirePermission } from '@/lib/permissions';
import { createOAuthState, buildAuthorizeUrl } from '@/lib/integrations/slack/oauth';

export async function GET(request: NextRequest) {
  try {
    const denied = requirePermission(request, 'admin');
    if (denied) return denied;
    const orgId = getOrgId(request);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const redirectUri = `${baseUrl}/api/integrations/slack/oauth/callback`;

    const state = await createOAuthState(orgId);
    const authorizeUrl = buildAuthorizeUrl(state, redirectUri);

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    console.error('Slack OAuth authorize error:', err);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    return NextResponse.redirect(`${baseUrl}/integrations?error=oauth_failed`);
  }
}
