/**
 * Ghostly Agent - Scheduled Task (Cron Job) Detail API
 *
 * PUT    /api/agent/cron-jobs/[id] - Update a scheduled task
 * DELETE /api/agent/cron-jobs/[id] - Delete a scheduled task
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { computeNextRunAt } from '@/lib/agent/scheduler';

const VALID_PRESETS = [
  'every_hour',
  'every_day_9am',
  'every_monday_9am',
  'every_weekday_9am',
  'every_friday_4pm',
  'first_of_month_9am',
  'custom',
];

const CRON_REGEX = /^(\S+\s+){4}\S+$/;

// ============================================
// PUT /api/agent/cron-jobs/[id]
// ============================================

export const PUT = withApiHandler(
  { permission: 'write', resource: 'agent-cron-jobs' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();
    const now = new Date();

    const { data: existingTask, error: existingError } = await supabase
      .from('agent_cron_jobs')
      .select('id, cron_expression, enabled, next_run_at')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (existingError || !existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    // Validate name (if provided)
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length === 0 || name.length > 100) {
        return NextResponse.json(
          { error: 'Task name must be 1-100 characters' },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    // Validate schedule preset (if provided)
    if (body.schedule_preset !== undefined) {
      if (!VALID_PRESETS.includes(body.schedule_preset)) {
        return NextResponse.json(
          { error: `Invalid schedule preset. Must be one of: ${VALID_PRESETS.join(', ')}` },
          { status: 400 }
        );
      }
      updates.schedule_preset = body.schedule_preset;
    }

    // Validate cron expression (if provided)
    if (body.cron_expression !== undefined) {
      const cronExpr = String(body.cron_expression).trim();
      if (!CRON_REGEX.test(cronExpr)) {
        return NextResponse.json(
          { error: 'Invalid cron expression. Must be 5-field format: minute hour day month weekday' },
          { status: 400 }
        );
      }
      updates.cron_expression = cronExpr;
      try {
        updates.next_run_at = computeNextRunAt(cronExpr, now).toISOString();
      } catch {
        return NextResponse.json(
          { error: 'Unable to compute next run time for the provided cron expression' },
          { status: 400 }
        );
      }
    }

    // Validate prompt (if provided)
    if (body.agent_prompt !== undefined) {
      const prompt = String(body.agent_prompt).trim();
      if (prompt.length === 0 || prompt.length > 2000) {
        return NextResponse.json(
          { error: 'Agent prompt must be 1-2000 characters' },
          { status: 400 }
        );
      }
      updates.agent_prompt = prompt;
    }

    // Toggle enabled
    if (body.enabled !== undefined) {
      updates.enabled = !!body.enabled;
      if (updates.enabled === true && updates.next_run_at === undefined) {
        try {
          updates.next_run_at = computeNextRunAt(existingTask.cron_expression, now).toISOString();
        } catch {
          return NextResponse.json(
            { error: 'Unable to compute next run time for this cron job' },
            { status: 400 }
          );
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: task, error } = await supabase
      .from('agent_cron_jobs')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ task });
  }
);

// ============================================
// DELETE /api/agent/cron-jobs/[id]
// ============================================

export const DELETE = withApiHandler(
  { permission: 'write', resource: 'agent-cron-jobs' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { error } = await supabase
      .from('agent_cron_jobs')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  }
);
