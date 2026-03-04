/**
 * Slack Slash Command Handler
 *
 * Handles /ghostly slash commands by parsing subcommands
 * and returning formatted responses.
 */

import { createClient } from '@/lib/supabase/server';
import { runAgentTask } from '@/lib/agent/runtime';
import { buildOrIlikeClause } from '@/lib/postgrest';

interface SlackCommand {
  command: string;
  text: string;
  user_id: string;
  user_name: string;
  channel_id: string;
  team_id: string;
  response_url: string;
  trigger_id: string;
}

interface CommandResponse {
  response_type: 'ephemeral' | 'in_channel';
  text: string;
}

/**
 * Handle a verified slash command.
 */
export async function handleSlackCommand(cmd: SlackCommand): Promise<CommandResponse> {
  const supabase = createClient();

  // Look up org from team_id
  const { data: integration } = await supabase
    .from('integrations')
    .select('organization_id')
    .eq('type', 'slack')
    .eq('status', 'active')
    .filter('credentials->>team_id', 'eq', cmd.team_id)
    .single();

  if (!integration) {
    return { response_type: 'ephemeral', text: 'Slack integration not found. Please reconnect in Ghostly settings.' };
  }

  const orgId = integration.organization_id;
  const [subcommand, ...rest] = cmd.text.trim().split(/\s+/);
  const argText = rest.join(' ');

  switch (subcommand?.toLowerCase()) {
    case 'events':
      return handleEventsCommand(orgId);
    case 'budget':
      return handleBudgetCommand(orgId, argText);
    case 'overdue':
      return handleOverdueCommand(orgId);
    case 'contacts':
      return handleContactsCommand(orgId, argText);
    case 'ask':
      return handleAskCommand(orgId, argText);
    case 'help':
    case '':
    case undefined:
      return handleHelpCommand();
    default:
      return {
        response_type: 'ephemeral',
        text: `Unknown command: \`${subcommand}\`. Try \`/ghostly help\` for available commands.`,
      };
  }
}

async function handleEventsCommand(orgId: string): Promise<CommandResponse> {
  const supabase = createClient();

  const { data: events } = await supabase
    .from('events')
    .select('name, date_start, date_end, location, stage, budget_amount')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .in('stage', ['confirmed', 'in_progress', 'ready', 'active'])
    .order('date_start', { ascending: true })
    .limit(10);

  if (!events || events.length === 0) {
    return { response_type: 'ephemeral', text: 'No upcoming events found.' };
  }

  const lines = events.map((e) => {
    const dates = e.date_start ? `${e.date_start}${e.date_end ? ` - ${e.date_end}` : ''}` : 'TBD';
    const budget = e.budget_amount ? `$${Number(e.budget_amount).toLocaleString()}` : 'No budget';
    return `• *${e.name}* — ${dates} | ${e.location || 'No location'} | ${budget} | _${e.stage}_`;
  });

  return {
    response_type: 'ephemeral',
    text: `*Upcoming Events (${events.length}):*\n${lines.join('\n')}`,
  };
}

async function handleBudgetCommand(orgId: string, eventName: string): Promise<CommandResponse> {
  const supabase = createClient();

  if (!eventName) {
    return { response_type: 'ephemeral', text: 'Usage: `/ghostly budget <event name>`' };
  }

  const { data: events } = await supabase
    .from('events')
    .select('id, name, budget_amount')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .ilike('name', `%${eventName}%`)
    .limit(1);

  if (!events || events.length === 0) {
    return { response_type: 'ephemeral', text: `No event found matching "${eventName}"` };
  }

  const event = events[0];

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('event_id', event.id)
    .eq('organization_id', orgId)
    .neq('budget_bucket', 'travel')
    .is('deleted_at', null);

  const totalSpent = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const budget = Number(event.budget_amount || 0);
  const remaining = budget - totalSpent;
  const pct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  return {
    response_type: 'ephemeral',
    text: `*Budget for ${event.name}:*\n• Budget: $${budget.toLocaleString()}\n• Spent: $${totalSpent.toLocaleString()} (${pct}%)\n• Remaining: $${remaining.toLocaleString()}`,
  };
}

async function handleOverdueCommand(orgId: string): Promise<CommandResponse> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: items } = await supabase
    .from('event_checklist_items')
    .select('title, due_date, events!inner(name, organization_id)')
    .eq('events.organization_id', orgId)
    .is('completed_at', null)
    .lt('due_date', today)
    .limit(10);

  const filtered = items || [];

  if (filtered.length === 0) {
    return { response_type: 'ephemeral', text: 'No overdue checklist items. Nice work!' };
  }

  const lines = filtered.map((item) => {
    const eventName = (item.events as unknown as { name: string })?.name || 'Unknown';
    return `• *${item.title}* — ${eventName} (due ${item.due_date})`;
  });

  return {
    response_type: 'ephemeral',
    text: `*Overdue Items (${filtered.length}):*\n${lines.join('\n')}`,
  };
}

async function handleContactsCommand(orgId: string, query: string): Promise<CommandResponse> {
  const supabase = createClient();

  if (!query) {
    return { response_type: 'ephemeral', text: 'Usage: `/ghostly contacts <search term>`' };
  }

  const searchClause = buildOrIlikeClause(['first_name', 'last_name', 'company'], query);
  if (!searchClause) {
    return { response_type: 'ephemeral', text: `No contacts found matching "${query}"` };
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('first_name, last_name, company, title, email')
    .eq('organization_id', orgId)
    .or(searchClause)
    .limit(5);

  if (!contacts || contacts.length === 0) {
    return { response_type: 'ephemeral', text: `No contacts found matching "${query}"` };
  }

  const lines = contacts.map((c) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    const role = [c.title, c.company].filter(Boolean).join(' at ');
    return `• *${name}*${role ? ` — ${role}` : ''}${c.email ? ` | ${c.email}` : ''}`;
  });

  return {
    response_type: 'ephemeral',
    text: `*Contacts (${contacts.length}):*\n${lines.join('\n')}`,
  };
}

async function handleAskCommand(orgId: string, prompt: string): Promise<CommandResponse> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { response_type: 'ephemeral', text: 'Usage: `/ghostly ask <question>`' };
  }

  try {
    const result = await runAgentTask({
      orgId,
      source: 'slack',
      prompt: trimmed,
      sessionTitle: `Slack Command :: ${new Date().toISOString()}`,
      allowAskTools: false,
      allowWriteTools: false,
    });

    return {
      response_type: 'ephemeral',
      text: result.content || 'No response generated.',
    };
  } catch (error) {
    return {
      response_type: 'ephemeral',
      text: `Agent request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

function handleHelpCommand(): CommandResponse {
  return {
    response_type: 'ephemeral',
    text: `*Ghostly Commands:*
• \`/ghostly events\` — List upcoming events
• \`/ghostly budget <event name>\` — Budget summary for an event
• \`/ghostly overdue\` — Overdue checklist items
• \`/ghostly contacts <search>\` — Search contacts
• \`/ghostly ask <question>\` — Ask the Ghostly agent in Slack
• \`/ghostly help\` — Show this help message`,
  };
}
