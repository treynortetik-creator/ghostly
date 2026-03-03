/**
 * Ghostly Agent - System Prompt Builder
 *
 * Constructs the dynamic system prompt for the AI agent based on
 * org settings, current page context, and available tools.
 */

import type { AgentTool } from './tools';

interface SystemPromptContext {
  /** Agent display name from agent_settings */
  agentName: string;
  /** Custom focus/instructions from agent_settings */
  agentFocus?: string | null;
  /** Event ID if the user is currently viewing an event page */
  eventId?: string | null;
  /** Event name for context */
  eventName?: string | null;
  /** Available tools the agent can use */
  tools: AgentTool[];
  /** Optional custom system prompt template from settings */
  customTemplate?: string | null;
}

/**
 * Build the full system prompt for the agent.
 */
export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const toolDescriptions = ctx.tools
    .map((t) => `- **${t.name}**: ${t.description}`)
    .join('\n');

  const contextSection = ctx.eventId
    ? `\n## Current Context\nThe user is currently viewing event "${ctx.eventName || ctx.eventId}" (ID: ${ctx.eventId}). When relevant, use this event as the default context for queries. If the user says "this event" or similar, they mean this one.`
    : '';

  const focusSection = ctx.agentFocus
    ? `\n## Custom Instructions\n${ctx.agentFocus}`
    : '';

  if (ctx.customTemplate && ctx.customTemplate.trim()) {
    const template = ctx.customTemplate.trim();
    const rendered = template
      .replaceAll('{{agent_name}}', ctx.agentName)
      .replaceAll('{{agent_focus}}', ctx.agentFocus || '')
      .replaceAll('{{tool_list}}', toolDescriptions)
      .replaceAll('{{event_context}}', contextSection || 'No specific event context.')
      .replaceAll('{{default_guidelines}}', [
        'Be concise and actionable.',
        'Never fabricate data.',
        'Summarize all modifications clearly.',
        'Use explicit travel fields (budget_bucket=travel, travel_cost_type, travel_logistics_entry_id) when handling travel costs.',
      ].join('\\n- '));

    return rendered;
  }

  return `You are ${ctx.agentName}, an AI assistant built into Ghostly — a corporate event management and budget tracking platform.

## Your Role
You help users manage events, track budgets and expenses, organize teams, and stay on top of deadlines. You have access to tools that read and write data in Ghostly.

## Available Tools
${toolDescriptions}

## Guidelines
- Be concise and actionable. Use markdown formatting (bold, lists, tables) for readability.
- When showing financial data, always format amounts as dollars (e.g. $12,500.00).
- When showing dates, use a human-readable format (e.g. "March 15, 2026").
- If the user asks something you cannot do with your tools, say so honestly.
- When modifying data (creating expenses, updating events, etc.), confirm the action and summarize what changed.
- If a tool call fails, explain the error in plain language and suggest what to try instead.
- Never fabricate data. Only report what the tools return.
- When asked about overdue tasks or budget issues, be proactive — highlight the most urgent items first.
- For travel-related expenses, use explicit travel fields ("budget_bucket=travel", "travel_cost_type", and optional "travel_logistics_entry_id") so travel/logistics and expenses stay synchronized.
- Do not rely on fuzzy vendor matching for travel sync. Use explicit event/travel assignment from available context or ask a follow-up question.
${contextSection}
${focusSection}

## Response Format
- Use short paragraphs and bullet points.
- Use tables for comparing multiple items.
- Bold key numbers and deadlines.
- Keep responses under 500 words unless the user asks for a detailed report.`;
}
