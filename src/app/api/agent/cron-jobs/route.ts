/**
 * Ghostly Agent - Scheduled Tasks (Cron Jobs) API
 *
 * GET  /api/agent/cron-jobs - List all scheduled tasks for current org
 * POST /api/agent/cron-jobs - Create a new scheduled task
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

const VALID_PRESETS = [
  'every_hour',
  'every_day_9am',
  'every_monday_9am',
  'every_weekday_9am',
  'every_friday_4pm',
  'first_of_month_9am',
  'custom',
];

const CRON_REGEX = /^(\S+\s+){4}\S+$/; // basic 5-field cron format

// ============================================
// GET /api/agent/cron-jobs
// ============================================

export const GET = withApiHandler(
  { permission: 'read', resource: 'agent-cron-jobs' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data: tasks, error } = await supabase
      .from('agent_cron_jobs')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ tasks: tasks || [] });
  }
);

// ============================================
// POST /api/agent/cron-jobs
// ============================================

export const POST = withApiHandler(
  { permission: 'write', resource: 'agent-cron-jobs' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const supabase = await createClient();

    // Validate name
    const name = String(body.name || '').trim();
    if (name.length === 0 || name.length > 100) {
      return NextResponse.json(
        { error: 'Task name must be 1-100 characters' },
        { status: 400 }
      );
    }

    // Validate schedule preset
    const preset = String(body.schedule_preset || '');
    if (!VALID_PRESETS.includes(preset)) {
      return NextResponse.json(
        { error: `Invalid schedule preset. Must be one of: ${VALID_PRESETS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate cron expression
    const cronExpr = String(body.cron_expression || '').trim();
    if (!CRON_REGEX.test(cronExpr)) {
      return NextResponse.json(
        { error: 'Invalid cron expression. Must be 5-field format: minute hour day month weekday' },
        { status: 400 }
      );
    }

    // Validate prompt
    const prompt = String(body.agent_prompt || '').trim();
    if (prompt.length === 0 || prompt.length > 2000) {
      return NextResponse.json(
        { error: 'Agent prompt must be 1-2000 characters' },
        { status: 400 }
      );
    }

    const { data: task, error } = await supabase
      .from('agent_cron_jobs')
      .insert({
        organization_id: orgId,
        name,
        schedule_preset: preset,
        cron_expression: cronExpr,
        agent_prompt: prompt,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task }, { status: 201 });
  }
);
