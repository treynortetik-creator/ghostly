/**
 * Ghostly - Notification Detail API
 *
 * DELETE /api/notifications/[id] - Hard-delete a single notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const DELETE = withApiHandler(
  { permission: 'write', resource: 'notifications' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  }
);
