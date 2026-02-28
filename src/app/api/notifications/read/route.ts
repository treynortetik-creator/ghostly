/**
 * Ghostly - Notifications Mark Read API
 *
 * PATCH /api/notifications/read - Bulk mark notifications as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const PATCH = withApiHandler(
  { permission: 'write', resource: 'notifications' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (body.all === true) {
      // Mark all unread notifications as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('organization_id', orgId)
        .eq('is_read', false)
        .is('dismissed_at', null);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('organization_id', orgId)
        .in('id', body.ids);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Provide { ids: [...] } or { all: true }' },
      { status: 400 }
    );
  }
);
