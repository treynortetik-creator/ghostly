/**
 * Ghostly - Reminder Config API
 *
 * Endpoints:
 * GET  /api/reminders/config - List all reminder configurations
 * PUT  /api/reminders/config - Update a reminder configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

// ============================================
// GET /api/reminders/config
// ============================================

export const GET = withApiHandler({ permission: 'admin', resource: 'reminders/config' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('reminder_config')
      .select('*')
      .eq('organization_id', orgId)
      .order('reminder_type');

    if (error) throw error;

    return NextResponse.json({
      configs: data || [],
      meta: { total: data?.length || 0 },
    });
  }
);

// ============================================
// PUT /api/reminders/config
// ============================================

export const PUT = withApiHandler({ permission: 'admin', resource: 'reminders/config' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();
    const body = await request.json();

    const { reminder_type, enabled, days_before, channel } = body;

    if (!reminder_type) {
      return NextResponse.json({ error: 'reminder_type is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (typeof days_before === 'number') updates.days_before = days_before;
    if (typeof channel === 'string') updates.channel = channel;

    const { data, error } = await supabase
      .from('reminder_config')
      .update(updates)
      .eq('reminder_type', reminder_type)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: `Reminder type '${reminder_type}' not found` }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ config: data });
  }
);
