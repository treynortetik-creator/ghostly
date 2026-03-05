/**
 * GET   /api/integrations/email/config - Get email integration config (masked)
 * PATCH /api/integrations/email/config - Update email integration credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

interface EmailCredentials {
  api_key?: string;
  from_email?: string;
  from_name?: string;
}

function maskApiKey(apiKey?: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return '********';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { data: integration } = await supabase
      .from('integrations')
      .select('id, status, credentials, updated_at')
      .eq('organization_id', orgId)
      .eq('type', 'email')
      .maybeSingle();

    if (!integration) {
      return NextResponse.json({
        configured: false,
        config: null,
      });
    }

    const creds = integration.credentials as EmailCredentials;
    const apiKey = creds.api_key || process.env.RESEND_API_KEY;

    return NextResponse.json({
      configured: Boolean(apiKey && creds.from_email),
      config: {
        integration_id: integration.id,
        status: integration.status,
        from_email: creds.from_email || null,
        from_name: creds.from_name || null,
        api_key_masked: maskApiKey(apiKey),
        updated_at: integration.updated_at,
      },
    });
  }
);

export const PATCH = withApiHandler(
  { permission: 'write', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();
    const body = await request.json();

    const apiKey = body.api_key !== undefined ? String(body.api_key).trim() : undefined;
    const fromEmail = body.from_email !== undefined ? String(body.from_email).trim() : undefined;
    const fromName = body.from_name !== undefined ? String(body.from_name).trim() : undefined;

    if (fromEmail !== undefined && fromEmail.length > 0 && !fromEmail.includes('@')) {
      return NextResponse.json({ error: 'from_email must be a valid email address' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('integrations')
      .select('credentials')
      .eq('organization_id', orgId)
      .eq('type', 'email')
      .maybeSingle();

    const existingCreds = (existing?.credentials || {}) as EmailCredentials;
    const credentials: EmailCredentials = {
      ...existingCreds,
    };

    if (apiKey !== undefined) credentials.api_key = apiKey;
    if (fromEmail !== undefined) credentials.from_email = fromEmail;
    if (fromName !== undefined) credentials.from_name = fromName;

    const { error } = await supabase
      .from('integrations')
      .upsert(
        {
          organization_id: orgId,
          type: 'email' as const,
          status: 'active' as const,
          credentials,
        },
        { onConflict: 'organization_id,type' }
      );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      config: {
        from_email: credentials.from_email || null,
        from_name: credentials.from_name || null,
        api_key_masked: maskApiKey(credentials.api_key || process.env.RESEND_API_KEY),
      },
    });
  }
);
