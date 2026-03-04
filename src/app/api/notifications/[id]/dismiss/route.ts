/**
 * Ghostly - Notification Dismiss API
 *
 * PATCH /api/notifications/[id]/dismiss - Soft-delete a notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const PATCH = withApiHandler(
  { permission: 'write', resource: 'notifications' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ notification });
  }
);
