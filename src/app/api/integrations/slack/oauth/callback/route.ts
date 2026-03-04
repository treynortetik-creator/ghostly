/**
 * GET /api/integrations/slack/oauth/callback
 *
 * Handles the OAuth callback from Slack. Exchanges the code for tokens
 * and stores the integration record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyOAuthState } from '@/lib/integrations/slack/oauth';
import { exchangeOAuthCode } from '@/lib/integrations/slack/client';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;

  // User denied or error from Slack
  if (error) {
    return NextResponse.redirect(`${appUrl}/integrations?error=${encodeURIComponent(error || 'unknown')}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=missing_params`);
  }

  // Verify state JWT
  const orgId = await verifyOAuthState(state);
  if (!orgId) {
    return NextResponse.redirect(`${appUrl}/integrations?error=invalid_state`);
  }

  try {
    const redirectUri = `${appUrl}/api/integrations/slack/oauth/callback`;
    const tokens = await exchangeOAuthCode(code, redirectUri);

    const supabase = await createClient();

    // Upsert the integration record
    const { error: dbError } = await supabase
      .from('integrations')
      .upsert(
        {
          organization_id: orgId,
          type: 'slack' as const,
          status: 'active' as const,
          credentials: {
            bot_token: tokens.bot_token,
            bot_user_id: tokens.bot_user_id,
            team_id: tokens.team_id,
            team_name: tokens.team_name,
            scope: tokens.scope,
          },
          installed_by: tokens.authed_user_id,
        },
        { onConflict: 'organization_id,type' }
      );

    if (dbError) throw dbError;

    // Create default digest config rows
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('type', 'slack')
      .single();

    if (integration) {
      await supabase
        .from('integration_digest_config')
        .upsert([
          {
            organization_id: orgId,
            integration_id: integration.id,
            digest_type: 'daily' as const,
            is_enabled: false,
            send_time: '09:00:00',
            day_of_week: 1,
          },
          {
            organization_id: orgId,
            integration_id: integration.id,
            digest_type: 'weekly' as const,
            is_enabled: false,
            send_time: '09:00:00',
            day_of_week: 1,
          },
        ], { onConflict: 'organization_id,integration_id,digest_type' });
    }

    return NextResponse.redirect(`${appUrl}/integrations?success=slack_connected`);
  } catch (err) {
    console.error('Slack OAuth callback error:', err);
    return NextResponse.redirect(`${appUrl}/integrations?error=token_exchange_failed`);
  }
}
