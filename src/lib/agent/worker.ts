/**
 * Agent Worker Runtime
 *
 * Executes scheduled agent runs (heartbeat + cron), event-driven checks,
 * and background tasks through a single worker path.
 */

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { runAgentTask } from '@/lib/agent/runtime';
import { computeNextRunAt, isDueByCron, minutesSince } from '@/lib/agent/scheduler';
import { routeNotificationToSlack } from '@/lib/integrations/slack/notifications';

type SupabaseClient = ReturnType<typeof createClient>;

const HEARTBEAT_TITLE_PREFIX = 'Heartbeat :: ';
const CRON_TITLE_PREFIX = 'Cron :: ';
const BACKGROUND_TITLE_PREFIX = 'Background :: ';

type NotificationType = 'agent_message' | 'budget_alert' | 'task_reminder' | 'custom_reminder';

interface WorkerOptions {
  orgId?: string;
  runHeartbeat?: boolean;
  runCron?: boolean;
  runTriggers?: boolean;
  runBackground?: boolean;
}

export interface WorkerSummary {
  organizations: number;
  heartbeatRuns: number;
  cronRuns: number;
  triggerNotifications: number;
  backgroundRuns: number;
  errors: Array<{ orgId: string; scope: string; error: string }>;
}

async function createNotification(
  supabase: SupabaseClient,
  orgId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .insert({
      organization_id: orgId,
      type,
      title,
      message,
      metadata: metadata as Json,
    });

  if (error) {
    throw error;
  }

  routeNotificationToSlack(orgId, type, title, message, metadata).catch(() => {});
}

async function getOrgIds(supabase: SupabaseClient, orgId?: string): Promise<string[]> {
  if (orgId) return [orgId];

  const { data: rows, error } = await supabase
    .from('agent_settings')
    .select('organization_id');

  if (error) throw error;
  return [...new Set((rows || []).map((row) => row.organization_id))];
}

async function runHeartbeatForOrg(supabase: SupabaseClient, orgId: string): Promise<number> {
  const { data: settings } = await supabase
    .from('agent_settings')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  if (!settings || settings.heartbeat_enabled !== true) {
    return 0;
  }

  const interval = Number(settings.heartbeat_interval || 60);
  const prompt = String(settings.heartbeat_prompt || '').trim() ||
    'Give a concise heartbeat: over-budget events, overdue tasks, and near-term priorities.';

  const { data: latestHeartbeat } = await supabase
    .from('chat_sessions')
    .select('created_at')
    .eq('organization_id', orgId)
    .ilike('title', `${HEARTBEAT_TITLE_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const minsSinceLast = minutesSince(latestHeartbeat?.created_at || null, new Date());
  if (minsSinceLast < interval) {
    return 0;
  }

  const autonomyMode = settings?.autonomy_mode === 'full' ? 'full' : 'safe';

  const result = await runAgentTask({
    orgId,
    source: 'heartbeat',
    prompt,
    sessionTitle: `${HEARTBEAT_TITLE_PREFIX}${new Date().toISOString()}`,
    allowAskTools: false,
    allowWriteTools: autonomyMode === 'full',
  });

  await createNotification(
    supabase,
    orgId,
    'agent_message',
    'Heartbeat update',
    result.content.slice(0, 2000),
    {
      trigger: 'heartbeat',
      session_id: result.sessionId,
      model: result.model,
      tool_calls: result.toolCalls,
    }
  );

  return 1;
}

async function runCronJobsForOrg(supabase: SupabaseClient, orgId: string): Promise<number> {
  const [{ data: settings }, { data: jobs, error: jobsError }] = await Promise.all([
    supabase
      .from('agent_settings')
      .select('*')
      .eq('organization_id', orgId)
      .single(),
    supabase
      .from('agent_cron_jobs')
      .select('*')
      .eq('organization_id', orgId)
      .eq('enabled', true)
      .order('created_at', { ascending: true }),
  ]);

  if (jobsError) throw jobsError;

  const now = new Date();
  const nowIso = now.toISOString();
  const autonomyMode = settings?.autonomy_mode === 'full' ? 'full' : 'safe';

  let runs = 0;

  for (const job of jobs || []) {
    const dueByNextRun = !!job.next_run_at && new Date(job.next_run_at) <= now;
    const dueByCron = !job.next_run_at && isDueByCron(job.cron_expression, now);

    if (!dueByNextRun && !dueByCron) continue;

    const nextRunAt = computeNextRunAt(job.cron_expression, now).toISOString();
    let claimFilter = supabase
      .from('agent_cron_jobs')
      .update({
        last_run_at: nowIso,
        next_run_at: nextRunAt,
      })
      .eq('id', job.id)
      .eq('organization_id', orgId)
      .eq('enabled', true);

    if (job.next_run_at) {
      claimFilter = claimFilter.eq('next_run_at', job.next_run_at);
    } else {
      claimFilter = claimFilter.is('next_run_at', null);
    }

    if (job.last_run_at) {
      claimFilter = claimFilter.eq('last_run_at', job.last_run_at);
    } else {
      claimFilter = claimFilter.is('last_run_at', null);
    }

    const { data: claimedJob, error: claimError } = await claimFilter.select('id').maybeSingle();
    if (claimError || !claimedJob) continue;

    const result = await runAgentTask({
      orgId,
      source: 'cron',
      prompt: job.agent_prompt,
      sessionTitle: `${CRON_TITLE_PREFIX}${job.name}`,
      allowAskTools: false,
      allowWriteTools: autonomyMode === 'full',
    });

    await createNotification(
      supabase,
      orgId,
      'agent_message',
      `Scheduled task: ${job.name}`,
      result.content.slice(0, 2000),
      {
        trigger: 'cron_job',
        cron_job_id: job.id,
        session_id: result.sessionId,
        model: result.model,
        tool_calls: result.toolCalls,
      }
    );

    runs += 1;
  }

  return runs;
}

async function hasRecentTriggerNotification(
  supabase: SupabaseClient,
  orgId: string,
  type: NotificationType,
  trigger: string,
  entityId: string,
  sinceHours: number
): Promise<boolean> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('notifications')
    .select('id')
    .eq('organization_id', orgId)
    .eq('type', type)
    .gte('created_at', since)
    .filter('metadata->>trigger', 'eq', trigger)
    .filter('metadata->>entity_id', 'eq', entityId)
    .limit(1);

  return !!data && data.length > 0;
}

async function claimTriggerNotification(supabase: SupabaseClient, params: {
  orgId: string;
  triggerKey: string;
  fallbackType: NotificationType;
  fallbackTrigger: string;
  fallbackEntityId: string;
  fallbackSinceHours: number;
}): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('agent_trigger_notifications')
      .insert({
        organization_id: params.orgId,
        trigger_key: params.triggerKey,
      })
      .select('id')
      .maybeSingle();

    if (!error) {
      return !!data;
    }

    // Unique violation means another worker already claimed this trigger key.
    if (error.code === '23505') {
      return false;
    }

    // Older deployments may not have this table yet. Fall back to legacy dedupe.
    if (error.code === '42P01') {
      const alreadySent = await hasRecentTriggerNotification(
        supabase,
        params.orgId,
        params.fallbackType,
        params.fallbackTrigger,
        params.fallbackEntityId,
        params.fallbackSinceHours
      );
      return !alreadySent;
    }

    throw error;
  } catch {
    // Last-resort fallback keeps behavior stable if claim table is unavailable.
    const alreadySent = await hasRecentTriggerNotification(
      supabase,
      params.orgId,
      params.fallbackType,
      params.fallbackTrigger,
      params.fallbackEntityId,
      params.fallbackSinceHours
    );
    return !alreadySent;
  }
}

async function processBudgetTriggers(supabase: SupabaseClient, orgId: string, eventFilter?: Set<string>): Promise<number> {
  const filteredEventIds = eventFilter ? [...eventFilter] : [];

  const [{ data: events, error: eventsError }, { data: expenses, error: expensesError }] = await Promise.all([
    (() => {
      let query = supabase
        .from('events')
        .select('id, name, budget_amount')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .gt('budget_amount', 0);

      if (filteredEventIds.length > 0) {
        query = query.in('id', filteredEventIds);
      }

      return query;
    })(),
    (() => {
      let query = supabase
        .from('expenses')
        .select('event_id, amount')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .neq('budget_bucket', 'travel')
        .not('event_id', 'is', null);

      if (filteredEventIds.length > 0) {
        query = query.in('event_id', filteredEventIds);
      }

      return query;
    })(),
  ]);

  if (eventsError) throw eventsError;
  if (expensesError) throw expensesError;

  const spendByEvent = new Map<string, number>();
  for (const expense of expenses || []) {
    if (!expense.event_id) continue;
    spendByEvent.set(expense.event_id, (spendByEvent.get(expense.event_id) || 0) + Number(expense.amount || 0));
  }

  let notifications = 0;

  for (const event of events || []) {
    if (eventFilter && !eventFilter.has(event.id)) continue;

    const budget = Number(event.budget_amount || 0);
    if (budget <= 0) continue;

    const spent = spendByEvent.get(event.id) || 0;
    if (spent <= budget) continue;

    const dedupeId = event.id;
    const dayKey = new Date().toISOString().slice(0, 10);
    const shouldSend = await claimTriggerNotification(supabase, {
      orgId,
      triggerKey: `over_budget:${dedupeId}:${dayKey}`,
      fallbackType: 'budget_alert',
      fallbackTrigger: 'over_budget',
      fallbackEntityId: dedupeId,
      fallbackSinceHours: 24,
    });
    if (!shouldSend) continue;

    await createNotification(
      supabase,
      orgId,
      'budget_alert',
      `Event over budget: ${event.name}`,
      `${event.name} is over budget by $${(spent - budget).toFixed(2)} (budget $${budget.toFixed(2)}, spent $${spent.toFixed(2)}).`,
      {
        trigger: 'over_budget',
        entity_id: dedupeId,
        event_id: event.id,
        budget,
        spent,
      }
    );

    notifications += 1;
  }

  return notifications;
}

export async function processBudgetTriggerForEvent(orgId: string, eventId: string): Promise<number> {
  if (!eventId) return 0;
  const supabase = createClient();
  return processBudgetTriggers(supabase, orgId, new Set([eventId]));
}

async function processOverdueChecklistTriggers(supabase: SupabaseClient, orgId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { data: overdue, error } = await supabase
    .from('event_checklist_items')
    .select('id, title, due_date, event_id, events!inner(name, organization_id)')
    .eq('events.organization_id', orgId)
    .is('completed_at', null)
    .lt('due_date', today);

  if (error) throw error;

  const byEvent = new Map<string, { eventName: string; count: number; oldestDue: string }>();

  for (const item of overdue || []) {
    const eventRel = item.events as unknown as { name?: string; organization_id?: string };
    if (!item.event_id) continue;

    const existing = byEvent.get(item.event_id);
    if (!existing) {
      byEvent.set(item.event_id, {
        eventName: eventRel?.name || 'Unknown Event',
        count: 1,
        oldestDue: item.due_date || today,
      });
      continue;
    }

    existing.count += 1;
    if ((item.due_date || today) < existing.oldestDue) {
      existing.oldestDue = item.due_date || today;
    }
  }

  let notifications = 0;

  for (const [eventId, info] of byEvent.entries()) {
    const dedupeId = `${eventId}:${today}`;
    const shouldSend = await claimTriggerNotification(supabase, {
      orgId,
      triggerKey: `overdue_checklist:${dedupeId}`,
      fallbackType: 'task_reminder',
      fallbackTrigger: 'overdue_checklist',
      fallbackEntityId: dedupeId,
      fallbackSinceHours: 24,
    });
    if (!shouldSend) continue;

    await createNotification(
      supabase,
      orgId,
      'task_reminder',
      `Overdue checklist items: ${info.eventName}`,
      `${info.eventName} has ${info.count} overdue checklist item(s). Oldest due date: ${info.oldestDue}.`,
      {
        trigger: 'overdue_checklist',
        entity_id: dedupeId,
        event_id: eventId,
        overdue_count: info.count,
        oldest_due_date: info.oldestDue,
      }
    );

    notifications += 1;
  }

  return notifications;
}

async function processTriggerChecksForOrg(supabase: SupabaseClient, orgId: string): Promise<number> {
  const [budgetNotifications, checklistNotifications] = await Promise.all([
    processBudgetTriggers(supabase, orgId),
    processOverdueChecklistTriggers(supabase, orgId),
  ]);

  return budgetNotifications + checklistNotifications;
}

async function processBackgroundTasksForOrg(supabase: SupabaseClient, orgId: string): Promise<number> {
  const nowIso = new Date().toISOString();

  const { data: tasks, error } = await supabase
    .from('agent_background_tasks')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .lte('run_after', nowIso)
    .order('created_at', { ascending: true })
    .limit(10);

  // Table may not exist yet on older deployments.
  if (error) {
    if (error.code === '42P01') {
      return 0;
    }
    throw error;
  }

  if (!tasks || tasks.length === 0) return 0;

  let runs = 0;

  for (const task of tasks) {
    const { data: claimedTask, error: claimError } = await supabase
      .from('agent_background_tasks')
      .update({ status: 'running', started_at: nowIso })
      .eq('id', task.id)
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claimError || !claimedTask) continue;

    try {
      const result = await runAgentTask({
        orgId,
        source: 'background',
        prompt: task.prompt,
        sessionTitle: `${BACKGROUND_TITLE_PREFIX}${task.name}`,
        allowAskTools: false,
        allowWriteTools: false,
      });

      await supabase
        .from('agent_background_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          session_id: result.sessionId,
          result: {
            content: result.content,
            model: result.model,
            tool_calls: result.toolCalls,
          },
        })
        .eq('id', task.id)
        .eq('organization_id', orgId);

      await createNotification(
        supabase,
        orgId,
        'agent_message',
        `Background task complete: ${task.name}`,
        result.content.slice(0, 2000),
        {
          trigger: 'background_task',
          entity_id: task.id,
          session_id: result.sessionId,
        }
      );

      runs += 1;
    } catch (runError) {
      await supabase
        .from('agent_background_tasks')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: runError instanceof Error ? runError.message : String(runError),
        })
        .eq('id', task.id)
        .eq('organization_id', orgId);
    }
  }

  return runs;
}

export async function runAgentWorker(options: WorkerOptions = {}): Promise<WorkerSummary> {
  const supabase = createClient();
  const orgIds = await getOrgIds(supabase, options.orgId);

  const summary: WorkerSummary = {
    organizations: orgIds.length,
    heartbeatRuns: 0,
    cronRuns: 0,
    triggerNotifications: 0,
    backgroundRuns: 0,
    errors: [],
  };

  for (const orgId of orgIds) {
    try {
      if (options.runHeartbeat !== false) {
        summary.heartbeatRuns += await runHeartbeatForOrg(supabase, orgId);
      }
    } catch (error) {
      summary.errors.push({
        orgId,
        scope: 'heartbeat',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      if (options.runCron !== false) {
        summary.cronRuns += await runCronJobsForOrg(supabase, orgId);
      }
    } catch (error) {
      summary.errors.push({
        orgId,
        scope: 'cron',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      if (options.runTriggers !== false) {
        summary.triggerNotifications += await processTriggerChecksForOrg(supabase, orgId);
      }
    } catch (error) {
      summary.errors.push({
        orgId,
        scope: 'triggers',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      if (options.runBackground !== false) {
        summary.backgroundRuns += await processBackgroundTasksForOrg(supabase, orgId);
      }
    } catch (error) {
      summary.errors.push({
        orgId,
        scope: 'background',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}
