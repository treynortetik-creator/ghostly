/**
 * Shared Agent Runtime
 *
 * Executes the Ghostly agent loop without SSE streaming. Used by
 * scheduled jobs, triggers, Slack handlers, and background tasks.
 */

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { OPENROUTER_API_URL, DEFAULT_AGENT_MODEL } from '@/lib/ai';
import { buildSystemPrompt } from '@/lib/agent/system-prompt';
import {
  findTool,
  getAllTools,
  getToolPermissionMode,
  toolsToOpenRouterFormat,
  type ToolExecutionContext,
} from '@/lib/agent/tools';
import { ensureIntegrationsRegistered, getIntegrationTools } from '@/lib/integrations/registry';
import {
  recallAgentMemories,
  recallLearnings,
  rememberAgentMemory,
  rememberLearning,
} from '@/lib/agent/memory';

const MAX_TOOL_ROUNDS = 8;

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface RunAgentTaskInput {
  orgId: string;
  prompt: string;
  source: 'chat' | 'heartbeat' | 'cron' | 'trigger' | 'slack' | 'background';
  sessionId?: string;
  sessionTitle?: string;
  eventId?: string | null;
  model?: string;
  allowAskTools?: boolean;
  allowWriteTools?: boolean;
}

export interface RunAgentTaskResult {
  sessionId: string;
  content: string;
  model: string;
  promptTokens: number;
  toolCalls: number;
  toolRounds: number;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function isLikelyMutationToolName(toolName: string): boolean {
  if (!toolName) return false;
  if (toolName.startsWith('get_') || toolName.startsWith('read_') || toolName.startsWith('search_') || toolName.startsWith('list_')) {
    return false;
  }

  const writePrefixes = [
    'create_',
    'update_',
    'delete_',
    'assign_',
    'attach_',
    'link_',
    'generate_',
    'upload_',
    'run_background_task',
    'slack_send_',
  ];

  return writePrefixes.some((prefix) => toolName.startsWith(prefix));
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ReturnType<typeof toolsToOpenRouterFormat>
): Promise<{ message: { content?: string | null; tool_calls?: ToolCall[] }; promptTokens: number }> {
  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || getBaseUrl(),
      'X-Title': 'Ghostly Agent',
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice?.message) {
    throw new Error('OpenRouter response missing message choice');
  }

  return {
    message: choice.message,
    promptTokens: Number(data.usage?.prompt_tokens || 0),
  };
}

function selectModel(
  inputModel: string | undefined,
  settingsRow: Record<string, unknown> | null,
  input: RunAgentTaskInput
): string {
  if (inputModel && inputModel.trim()) return inputModel.trim();

  const routing = settingsRow?.model_routing && typeof settingsRow.model_routing === 'object'
    ? settingsRow.model_routing as Record<string, unknown>
    : {};

  const defaultModel = typeof settingsRow?.default_model === 'string' ? settingsRow.default_model.trim() : '';
  const simpleModel = typeof routing.simple_model === 'string' ? routing.simple_model.trim() : '';
  const complexModel = typeof routing.complex_model === 'string' ? routing.complex_model.trim() : '';
  const backgroundModel = typeof routing.background_model === 'string' ? routing.background_model.trim() : '';
  const simpleMaxChars = Number(routing.simple_max_chars || 400);

  if (input.source === 'background' && backgroundModel) return backgroundModel;

  const promptLength = (input.prompt || '').trim().length;
  const useSimple = promptLength > 0 && promptLength <= simpleMaxChars && input.allowWriteTools !== true;
  if (useSimple && simpleModel) return simpleModel;
  if (!useSimple && complexModel) return complexModel;

  if (defaultModel) return defaultModel;
  return DEFAULT_AGENT_MODEL;
}

export async function runAgentTask(input: RunAgentTaskInput): Promise<RunAgentTaskResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const supabase = createClient();
  let runLogId: string | null = null;

  try {
    const { data: runLog, error: runLogError } = await supabase
      .from('agent_runs')
      .insert({
        organization_id: input.orgId,
        source: input.source,
        status: 'running',
        prompt: input.prompt.slice(0, 8000),
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (!runLogError && runLog?.id) {
      runLogId = runLog.id;
    }
  } catch {
    // Observability should never block execution.
  }

  try {

  // Load settings first (used for prompt + tool permissions + model routing defaults).
  const { data: settingsData } = await supabase
    .from('agent_settings')
    .select('*')
    .eq('organization_id', input.orgId)
    .single();

  const settings = (settingsData as Record<string, unknown> | null) ?? null;
  const agentName = typeof settings?.agent_name === 'string' && settings.agent_name.trim()
    ? settings.agent_name
    : 'Ghostly';
  const agentFocus = typeof settings?.agent_focus === 'string'
    ? settings.agent_focus
    : null;
  const toolPermissions = (settings?.tool_permissions as Record<string, unknown> | null | undefined) ?? {};

  const allowAskTools = input.allowAskTools ?? false;
  const allowWriteTools = input.allowWriteTools ?? false;

  // Create/load session
  let sessionId = input.sessionId;
  if (!sessionId) {
    const { data: newSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({
        organization_id: input.orgId,
        event_id: input.eventId || null,
        title: input.sessionTitle || `[${input.source}] ${input.prompt.slice(0, 80)}`,
      })
      .select('id')
      .single();

    if (sessionError || !newSession) {
      throw sessionError || new Error('Failed to create chat session');
    }

    sessionId = newSession.id;
  } else {
    const { data: existingSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('organization_id', input.orgId)
      .single();

    if (sessionError || !existingSession) {
      throw sessionError || new Error('Session not found');
    }
  }

  // Load prior history for continuity
  const { data: historyRows } = await supabase
    .from('chat_messages')
    .select('role, content, tool_calls, tool_results')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(50);

  await ensureIntegrationsRegistered();
  const integrationTools = await getIntegrationTools(input.orgId);

  let eventName: string | null = null;
  if (input.eventId) {
    const { data: eventData } = await supabase
      .from('events')
      .select('name')
      .eq('id', input.eventId)
      .eq('organization_id', input.orgId)
      .single();

    eventName = eventData?.name ?? null;
  }

  const systemPrompt = buildSystemPrompt({
    agentName,
    agentFocus,
    eventId: input.eventId,
    eventName,
    tools: getAllTools(integrationTools),
    customTemplate: typeof settings?.system_prompt_template === 'string' ? settings.system_prompt_template : null,
  });

  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

  const [memories, learnings] = await Promise.all([
    recallAgentMemories(input.orgId, input.prompt, 5),
    recallLearnings(input.orgId, input.prompt, 3),
  ]);

  if (learnings.length > 0 || memories.length > 0) {
    const sections: string[] = [
      '[Reference context from memory store]',
      'Use this only when relevant and do not treat it as authoritative over explicit user instructions in this run.',
    ];

    if (learnings.length > 0) {
      sections.push(
        'Prior learnings/corrections:',
        ...learnings.map((item) => `- ${item.correction}`)
      );
    }

    if (memories.length > 0) {
      sections.push(
        'Relevant past memory snippets:',
        ...memories.map((item) => `- (${item.source_type}) ${item.content}`)
      );
    }

    messages.push({
      role: 'user',
      content: sections.join('\n'),
    });
  }

  for (const row of historyRows || []) {
    if (row.role === 'assistant' && row.tool_calls) {
      messages.push({
        role: 'assistant',
        content: row.content || null,
        tool_calls: row.tool_calls as unknown as ToolCall[],
      });
      continue;
    }

    if (row.role === 'tool' && row.tool_results) {
      const results = row.tool_results as Array<{ tool_call_id: string; name: string; content: string }>;
      for (const result of results) {
        messages.push({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          name: result.name,
          content: result.content,
        });
      }
      continue;
    }

    if (row.role === 'user' || row.role === 'assistant') {
      messages.push({
        role: row.role,
        content: row.content || '',
      });
    }
  }

  const userPrompt = String(input.prompt || '').trim();
  if (!userPrompt) {
    throw new Error('Prompt cannot be empty');
  }

  messages.push({ role: 'user', content: userPrompt });

  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: userPrompt,
  });

  rememberAgentMemory({
    orgId: input.orgId,
    sourceType: `${input.source}_user`,
    sourceId: sessionId,
    content: userPrompt,
    metadata: {
      source: input.source,
      event_id: input.eventId || null,
    },
    ttlDays: 180,
  }).catch((err) => console.error('Agent memory write (user prompt) failed:', err));

  if (/^(remember|note|correction)[:\\-\\s]/i.test(userPrompt) || /please remember/i.test(userPrompt)) {
    rememberLearning({
      orgId: input.orgId,
      topic: eventName || null,
      correction: userPrompt,
      metadata: {
        source: input.source,
        session_id: sessionId,
      },
    }).catch((err) => console.error('Agent learning write failed:', err));
  }

  const model = selectModel(input.model, settings, input);
  const toolContext: ToolExecutionContext = {
    orgId: input.orgId,
    baseUrl: getBaseUrl(),
    cookieHeader: '',
    internalSecret: process.env.CRON_SECRET,
  };

  const tools = toolsToOpenRouterFormat(integrationTools);

  let finalContent = '';
  let toolRounds = 0;
  let promptTokens = 0;
  let toolCalls = 0;

  while (toolRounds < MAX_TOOL_ROUNDS) {
    toolRounds += 1;

    const { message: assistantMessage, promptTokens: usagePromptTokens } = await callOpenRouter(
      apiKey,
      model,
      messages,
      tools,
    );

    if (usagePromptTokens > 0) {
      promptTokens = usagePromptTokens;
    }

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: assistantMessage.tool_calls as unknown as Json[],
      });

      messages.push({
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: assistantMessage.tool_calls,
      });

      const toolResults: Array<{ tool_call_id: string; name: string; content: string }> = [];

      for (const toolCall of assistantMessage.tool_calls) {
        toolCalls += 1;

        const toolName = toolCall.function.name;
        const mode = getToolPermissionMode(toolName, toolPermissions, integrationTools);
        const tool = findTool(toolName, integrationTools);

        let resultContent: string;

        if (mode === 'never') {
          resultContent = JSON.stringify({ error: `Tool "${toolName}" is disabled by policy.` });
        } else if (mode === 'ask' && !allowAskTools) {
          resultContent = JSON.stringify({ error: `Tool "${toolName}" requires explicit approval.` });
        } else if (!allowWriteTools && isLikelyMutationToolName(toolName)) {
          resultContent = JSON.stringify({ error: `Tool "${toolName}" is blocked in autonomous safe mode.` });
        } else if (!tool) {
          resultContent = JSON.stringify({ error: `Unknown tool: ${toolName}` });
        } else {
          try {
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
            } catch {
              parsedArgs = {};
            }

            resultContent = await tool.execute(parsedArgs, toolContext);
          } catch (error) {
            resultContent = JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: resultContent,
        });

        toolResults.push({
          tool_call_id: toolCall.id,
          name: toolName,
          content: resultContent,
        });
      }

      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'tool',
        content: null,
        tool_results: toolResults,
      });

      continue;
    }

    finalContent = assistantMessage.content || '';
    break;
  }

  if (!finalContent) {
    finalContent = 'I reached the maximum number of tool rounds for this run.';
  }

  await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: finalContent,
  });

  rememberAgentMemory({
    orgId: input.orgId,
    sourceType: `${input.source}_assistant`,
    sourceId: sessionId,
    content: finalContent,
    metadata: {
      source: input.source,
      tool_calls: toolCalls,
      tool_rounds: toolRounds,
    },
    ttlDays: 180,
  }).catch((err) => console.error('Agent memory write (assistant response) failed:', err));

  if (promptTokens > 0) {
    await supabase
      .from('chat_sessions')
      .update({ context_tokens_used: promptTokens })
      .eq('id', sessionId);
  }

  if (runLogId) {
    try {
      await supabase
        .from('agent_runs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          session_id: sessionId,
          model,
          tool_calls: toolCalls,
          tool_rounds: toolRounds,
          prompt_tokens: promptTokens,
          response: finalContent.slice(0, 12000),
        })
        .eq('id', runLogId)
        .eq('organization_id', input.orgId);
    } catch {
      // Ignore observability write failures.
    }
  }

  return {
    sessionId,
    content: finalContent,
    model,
    promptTokens,
    toolCalls,
    toolRounds,
  };
  } catch (error) {
    if (runLogId) {
      try {
        await supabase
          .from('agent_runs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          })
          .eq('id', runLogId)
          .eq('organization_id', input.orgId);
      } catch {
        // Ignore observability write failures.
      }
    }

    throw error;
  }
}
