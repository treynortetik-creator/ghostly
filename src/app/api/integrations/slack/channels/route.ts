/**
 * GET /api/integrations/slack/channels?query=search
 *
 * Proxy to list Slack channels for the current org.
 * Used by the frontend channel selector.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { getSlackBotToken, listChannels } from '@/lib/integrations/slack/client';

export const GET = withApiHandler(
  { permission: 'read', resource: 'integrations' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || undefined;

    const token = await getSlackBotToken(orgId);
    if (!token) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 });
    }

    const result = await listChannels(token, { query, limit: 50 });
    return NextResponse.json({ channels: result.channels });
  }
);
