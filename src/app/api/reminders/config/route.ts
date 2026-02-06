/**
 * The Counting House - Reminder Config API
 *
 * Endpoints:
 * GET  /api/reminders/config - List all reminder configurations
 * PUT  /api/reminders/config - Update a reminder configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';
import { requirePermission } from '@/lib/permissions';

// ============================================
// GET /api/reminders/config
// ============================================

export async function GET(request: NextRequest) {
  const denied = requirePermission(request, 'admin');
  if (denied) return denied;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('reminder_config')
      .select('*')
      .order('reminder_type');

    if (error) throw error;

    return NextResponse.json({
      configs: data || [],
      meta: { total: data?.length || 0 },
    });
  } catch (err) {
    console.error('Reminder config GET error:', err);
    logError('Failed to fetch reminder configs', { error: err as Error, source: 'api/reminders/config', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch reminder configs' }, { status: 500 });
  }
}

// ============================================
// PUT /api/reminders/config
// ============================================

export async function PUT(request: NextRequest) {
  const deniedPut = requirePermission(request, 'admin');
  if (deniedPut) return deniedPut;

  try {
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
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: `Reminder type '${reminder_type}' not found` }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ config: data });
  } catch (err) {
    console.error('Reminder config PUT error:', err);
    logError('Failed to update reminder config', { error: err as Error, source: 'api/reminders/config', context: { method: 'PUT' } });
    return NextResponse.json({ error: 'Failed to update reminder config' }, { status: 500 });
  }
}
