/**
 * Ghostly - Notifications API
 *
 * GET    /api/notifications - List notifications for current org
 * POST   /api/notifications - Create a notification
 * DELETE /api/notifications - Bulk delete notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { routeNotificationToSlack } from '@/lib/integrations/slack/notifications';

const VALID_TYPES = ['agent_message', 'budget_alert', 'task_reminder', 'custom_reminder'];

// ============================================
// GET /api/notifications
// ============================================

export const GET = withApiHandler(
  { permission: 'read', resource: 'notifications' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();
    const url = new URL(request.url);

    const status = url.searchParams.get('status') || 'unread';
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    // Build query — always exclude dismissed
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('organization_id', orgId)
      .is('dismissed_at', null)
      .order('is_read', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === 'unread') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;
    if (error) throw error;

    // Always include unread count for badge
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_read', false)
      .is('dismissed_at', null);

    if (countError) throw countError;

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: count || 0,
    });
  }
);

// ============================================
// POST /api/notifications
// ============================================

export const POST = withApiHandler(
  { permission: 'write', resource: 'notifications' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    // Validate type
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid notification type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate title
    const title = String(body.title || '').trim();
    if (title.length === 0 || title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 1-200 characters' },
        { status: 400 }
      );
    }

    // Validate message
    const message = String(body.message || '').trim();
    if (message.length === 0 || message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be 1-2000 characters' },
        { status: 400 }
      );
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        organization_id: orgId,
        type: body.type,
        title,
        message,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    // Fire-and-forget: route to Slack if configured
    routeNotificationToSlack(orgId, body.type, title, message, body.metadata).catch(() => {});

    return NextResponse.json({ notification }, { status: 201 });
  }
);

// ============================================
// DELETE /api/notifications (bulk)
// ============================================

export const DELETE = withApiHandler(
  { permission: 'write', resource: 'notifications' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    if (body.dismissed === true) {
      // Delete all dismissed notifications for this org
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('organization_id', orgId)
        .not('dismissed_at', 'is', null);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('organization_id', orgId)
        .in('id', body.ids);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Provide { ids: [...] } or { dismissed: true }' },
      { status: 400 }
    );
  }
);
