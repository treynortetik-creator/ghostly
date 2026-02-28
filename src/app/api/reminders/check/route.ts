/**
 * Ghostly - Reminder Check API
 *
 * Endpoints:
 * POST /api/reminders/check - Check for due reminders (AI agent calls this)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation } from '@/lib/api-helpers';

// ============================================
// POST /api/reminders/check
// ============================================

export const POST = withApiHandler({ permission: 'read', resource: 'reminders/check' },
  async (request: NextRequest) => {
    const supabase = await createClient();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get enabled reminder configs
    const { data: configs, error: configError } = await supabase
      .from('reminder_config')
      .select('*')
      .eq('enabled', true);

    if (configError) throw configError;
    if (!configs || configs.length === 0) {
      return NextResponse.json({ reminders: [], meta: { total: 0, message: 'No enabled reminder configs' } });
    }

    // Get all upcoming events (not deleted, with a date_start)
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, name, date_start, date_end, budget_amount')
      .is('deleted_at', null)
      .not('date_start', 'is', null)
      .gte('date_start', todayStr);

    if (eventsError) throw eventsError;

    // Get today's reminder log to avoid duplicates
    const { data: sentToday, error: logErr } = await supabase
      .from('reminder_log')
      .select('reminder_type, entity_id')
      .gte('sent_at', todayStr + 'T00:00:00Z')
      .lte('sent_at', todayStr + 'T23:59:59Z');

    if (logErr) throw logErr;

    const sentSet = new Set(
      (sentToday || []).map(r => `${r.reminder_type}:${r.entity_id}`)
    );

    // Check each event against each config
    const reminders: Array<{
      type: string;
      event_id: string;
      event_name: string;
      date_start: string;
      days_until: number;
      channel: string;
    }> = [];

    for (const event of events || []) {
      const eventDate = new Date(event.date_start + 'T12:00:00');
      const diffMs = eventDate.getTime() - today.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      for (const config of configs) {
        if (daysUntil <= config.days_before && daysUntil >= 0) {
          const key = `${config.reminder_type}:${event.id}`;
          if (!sentSet.has(key)) {
            reminders.push({
              type: config.reminder_type,
              event_id: event.id,
              event_name: event.name,
              date_start: event.date_start!,
              days_until: daysUntil,
              channel: config.channel,
            });
          }
        }
      }
    }

    // Log the reminders we're returning (so they won't be returned again today)
    if (reminders.length > 0) {
      const logEntries = reminders.map(r => ({
        reminder_type: r.type,
        entity_type: 'event',
        entity_id: r.event_id,
        channel: r.channel,
      }));

      await supabase.from('reminder_log').insert(logEntries);
    }

    // Audit log reminder check
    if (reminders.length > 0) {
      await auditMutation(request, {
        entity_type: 'reminder',
        entity_id: 'check',
        action: 'check',
        changes: null,
        metadata: { reminders_found: reminders.length },
      });
    }

    return NextResponse.json({
      reminders,
      meta: { total: reminders.length, checked_at: new Date().toISOString() },
    });
  }
);
