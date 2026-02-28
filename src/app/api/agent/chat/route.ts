/**
 * Ghostly Agent - Chat API Route
 *
 * POST /api/agent/chat
 * Body: { session_id?: string, message: string, event_id?: string }
 *
 * Handles the full agent conversation loop:
 * 1. Create/load session
 * 2. Build system prompt with context
 * 3. Call OpenRouter with tool definitions
 * 4. Execute tool calls, feed results back to LLM
 * 5. Repeat until LLM produces a final text response
 * 6. Stream response via SSE
 * 7. Persist all messages to DB
 *
 * NOTE: Does not use withApiHandler because this route returns a streaming
 * Response (SSE), not a NextResponse. Permission check is done manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/permissions';
import { getOrgId } from '@/lib/api-helpers';
import { agentTools, findTool, toolsToOpenRouterFormat } from '@/lib/agent/tools';
import { buildSystemPrompt } from '@/lib/agent/system-prompt';
import type { ToolExecutionContext } from '@/lib/agent/tools';
import { logError } from '@/lib/error-logger';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

// Agent uses a model that supports tool calling well
const AGENT_MODEL = 'anthropic/claude-sonnet-4';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// Max tool-call rounds to prevent runaway loops
const MAX_TOOL_ROUNDS = 8;

export async function POST(request: NextRequest) {
  // Manual permission check (can't use withApiHandler because we return a streaming Response)
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const orgId = getOrgId(request);
    const body = await request.json();
    const { message, event_id } = body;
    let { session_id } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key is not configured' },
        { status: 500 }
      );
    }

    const supabase = await createClient();

    // ─── Load or create session ──────────────────────────────────────────
    if (!session_id) {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          organization_id: orgId,
          event_id: event_id || null,
          title: message.slice(0, 100),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      session_id = newSession.id;
    } else {
      const { data: existingSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', session_id)
        .eq('organization_id', orgId)
        .single();

      if (sessionError || !existingSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
    }

    // ─── Load conversation history ───────────────────────────────────────
    const { data: historyRows } = await supabase
      .from('chat_messages')
      .select('role, content, tool_calls, tool_results')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(50);

    // ─── Load agent settings ─────────────────────────────────────────────
    const { data: settings } = await supabase
      .from('agent_settings')
      .select('agent_name, agent_focus')
      .eq('organization_id', orgId)
      .single();

    const agentName = settings?.agent_name || 'Ghostly';
    const agentFocus = settings?.agent_focus || null;

    // ─── Load event context if provided ──────────────────────────────────
    let eventName: string | null = null;
    if (event_id) {
      const { data: eventData } = await supabase
        .from('events')
        .select('name')
        .eq('id', event_id)
        .eq('organization_id', orgId)
        .single();
      eventName = eventData?.name ?? null;
    }

    // ─── Build system prompt ─────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      agentName,
      agentFocus,
      eventId: event_id,
      eventName,
      tools: agentTools,
    });

    // ─── Build messages array ────────────────────────────────────────────
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add history
    for (const row of historyRows ?? []) {
      if (row.role === 'assistant' && row.tool_calls) {
        messages.push({
          role: 'assistant',
          content: row.content || null,
          tool_calls: row.tool_calls as unknown as ToolCall[],
        });
      } else if (row.role === 'tool' && row.tool_results) {
        const results = row.tool_results as unknown as Array<{
          tool_call_id: string;
          name: string;
          content: string;
        }>;
        for (const tr of results) {
          messages.push({
            role: 'tool',
            tool_call_id: tr.tool_call_id,
            name: tr.name,
            content: tr.content,
          });
        }
      } else {
        messages.push({
          role: row.role as 'user' | 'assistant',
          content: row.content || '',
        });
      }
    }

    // Add the new user message
    messages.push({ role: 'user', content: message.trim() });

    // ─── Save the user message to DB ─────────────────────────────────────
    await supabase.from('chat_messages').insert({
      session_id,
      role: 'user',
      content: message.trim(),
    });

    // ─── Build tool context ──────────────────────────────────────────────
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const cookieHeader = request.headers.get('cookie') || '';

    const toolContext: ToolExecutionContext = {
      orgId,
      baseUrl,
      cookieHeader,
    };

    // ─── Tool-use loop ───────────────────────────────────────────────────
    const toolCallMessages: Array<{ role: string; content: string | null; tool_calls?: ToolCall[] }> = [];
    let finalContent = '';
    let toolRounds = 0;

    const openRouterTools = toolsToOpenRouterFormat();

    while (toolRounds < MAX_TOOL_ROUNDS) {
      toolRounds++;

      const orResponse = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || baseUrl,
          'X-Title': 'Ghostly Agent',
        },
        body: JSON.stringify({
          model: AGENT_MODEL,
          messages,
          tools: openRouterTools,
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!orResponse.ok) {
        const errorText = await orResponse.text();
        console.error('OpenRouter API error:', orResponse.status, errorText);
        finalContent = 'I encountered an error while processing your request. Please try again later.';
        break;
      }

      const orData = await orResponse.json();
      const choice = orData.choices?.[0];

      if (!choice) {
        finalContent = 'I received an unexpected response. Please try again.';
        break;
      }

      const assistantMessage = choice.message;

      // If there are tool calls, execute them
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls,
        });

        await supabase.from('chat_messages').insert({
          session_id,
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls,
        });

        const toolResults: Array<{
          tool_call_id: string;
          name: string;
          content: string;
        }> = [];

        for (const tc of assistantMessage.tool_calls) {
          const toolName = tc.function.name;
          const tool = findTool(toolName);

          let resultContent: string;
          if (!tool) {
            resultContent = JSON.stringify({ error: `Unknown tool: ${toolName}` });
          } else {
            try {
              let parsedArgs: Record<string, unknown> = {};
              try {
                parsedArgs = JSON.parse(tc.function.arguments || '{}');
              } catch {
                parsedArgs = {};
              }
              resultContent = await tool.execute(parsedArgs, toolContext);
            } catch (err) {
              resultContent = JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: toolName,
            content: resultContent,
          });

          toolResults.push({
            tool_call_id: tc.id,
            name: toolName,
            content: resultContent,
          });
        }

        await supabase.from('chat_messages').insert({
          session_id,
          role: 'tool',
          content: null,
          tool_results: toolResults,
        });

        toolCallMessages.push({
          role: 'tool_use',
          content: null,
          tool_calls: assistantMessage.tool_calls,
        });

        continue;
      }

      // No tool calls — final text response
      finalContent = assistantMessage.content || '';
      break;
    }

    if (toolRounds >= MAX_TOOL_ROUNDS && !finalContent) {
      finalContent = 'I reached the maximum number of tool calls. Here is what I found so far — please ask a more specific question if you need more details.';
    }

    // ─── Save final assistant response to DB ─────────────────────────────
    await supabase.from('chat_messages').insert({
      session_id,
      role: 'assistant',
      content: finalContent,
    });

    // ─── Stream the response via SSE ─────────────────────────────────────
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send session_id first
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'session', session_id })}\n\n`)
        );

        // Send tool call info if any
        for (const tcm of toolCallMessages) {
          if (tcm.tool_calls) {
            for (const tc of tcm.tool_calls) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_call',
                    name: tc.function.name,
                    arguments: tc.function.arguments,
                  })}\n\n`
                )
              );
            }
          }
        }

        // Stream the final content in chunks
        const chunkSize = 20;
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          const chunk = finalContent.slice(i, i + chunkSize);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`)
          );
        }

        // Send done event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', session_id })}\n\n`)
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    logError('Agent chat failed', {
      error: error as Error,
      source: 'api/agent/chat',
    });
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
