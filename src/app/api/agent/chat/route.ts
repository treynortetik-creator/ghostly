/**
 * Ghostly Agent - Chat API Route
 *
 * POST /api/agent/chat
 * Body: JSON { session_id?, message, event_id? } or multipart/form-data with files
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
import {
  agentTools,
  findTool,
  getToolPermissionMode,
  toolsToOpenRouterFormat,
} from '@/lib/agent/tools';
import { buildSystemPrompt } from '@/lib/agent/system-prompt';
import type { ToolExecutionContext } from '@/lib/agent/tools';
import { getIntegrationTools, ensureIntegrationsRegistered } from '@/lib/integrations/registry';
import { logError } from '@/lib/error-logger';
import { extractTextFromFile, isImageType } from '@/lib/agent/file-processor';
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants';
import {
  recallAgentMemories,
  recallLearnings,
  rememberAgentMemory,
  rememberLearning,
} from '@/lib/agent/memory';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

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

// Context window management
const CONTEXT_LIMIT = 196000;
const COMPACTION_THRESHOLD = 0.80;

function selectChatModel(
  settings: Record<string, unknown> | null | undefined,
  userMessage: string
): string {
  const routing = settings?.model_routing && typeof settings.model_routing === 'object'
    ? settings.model_routing as Record<string, unknown>
    : {};

  const defaultModel = typeof settings?.default_model === 'string' && settings.default_model.trim()
    ? settings.default_model.trim()
    : AGENT_MODEL;

  const simpleModel = typeof routing.simple_model === 'string' ? routing.simple_model.trim() : '';
  const complexModel = typeof routing.complex_model === 'string' ? routing.complex_model.trim() : '';
  const simpleMaxChars = Number(routing.simple_max_chars || 350);
  const trimmedLen = userMessage.trim().length;
  const useSimple = trimmedLen > 0 && trimmedLen <= simpleMaxChars;

  if (useSimple && simpleModel) return simpleModel;
  if (!useSimple && complexModel) return complexModel;
  return defaultModel;
}

/**
 * Generate a compaction summary of the conversation so far.
 * Sends the conversation history to Claude with a summarization prompt.
 */
async function generateCompactionSummary(
  historyRows: Array<{ role: string; content: string | null; tool_calls: unknown; tool_results: unknown }>,
  apiKey: string,
  baseUrl: string,
): Promise<string> {
  const conversationText = historyRows
    .filter((row) => row.role === 'user' || (row.role === 'assistant' && row.content))
    .map((row) => `${row.role}: ${row.content ?? ''}`)
    .join('\n');

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || baseUrl,
      'X-Title': 'Ghostly Agent',
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a conversation summarizer. Produce a concise summary (under 500 words) of the following conversation. Preserve key facts, decisions, data points, and action items. Do not add commentary — just summarize.',
        },
        {
          role: 'user',
          content: conversationText,
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Compaction summary request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function findPendingToolCalls(
  historyRows: Array<{ role: string; tool_calls: unknown; tool_results: unknown }>
): ToolCall[] {
  for (let i = historyRows.length - 1; i >= 0; i--) {
    const row = historyRows[i];
    if (row.role !== 'assistant' || !Array.isArray(row.tool_calls)) continue;

    const toolCalls = row.tool_calls as ToolCall[];
    if (toolCalls.length === 0) continue;

    const unresolvedIds = new Set(toolCalls.map((tc) => tc.id));
    for (let j = i + 1; j < historyRows.length; j++) {
      const next = historyRows[j];
      if (next.role !== 'tool' || !Array.isArray(next.tool_results)) continue;
      const results = next.tool_results as Array<{ tool_call_id?: string }>;
      for (const result of results) {
        if (result.tool_call_id) {
          unresolvedIds.delete(result.tool_call_id);
        }
      }
    }

    if (unresolvedIds.size > 0) {
      return toolCalls.filter((tc) => unresolvedIds.has(tc.id));
    }
  }

  return [];
}

export async function POST(request: NextRequest) {
  // Manual permission check (can't use withApiHandler because we return a streaming Response)
  const denied = requirePermission(request, 'write');
  if (denied) return denied;

  try {
    const orgId = getOrgId(request);

    // ─── Parse request body (JSON or multipart) ─────────────────────────
    let message = '';
    let event_id: string | undefined;
    let session_id: string | undefined;
    let approvedToolCallIds: string[] = [];
    let hasToolApprovalPayload = false;
    const uploadedFiles: Array<{
      document_id: string;
      filename: string;
      mime_type: string;
      storage_path: string;
    }> = [];

    const contentType = request.headers.get('content-type') || '';
    const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      message = (formData.get('message') as string) || '';
      event_id = (formData.get('event_id') as string) || undefined;
      session_id = (formData.get('session_id') as string) || undefined;

      // Process uploaded files (max 5)
      const files = formData.getAll('files') as File[];
      const filesToProcess = files.slice(0, 5);

      const supabaseForFiles = await createClient();

      const ALLOWED_CHAT_EXTENSIONS = [
        '.pdf', '.docx', '.xlsx', '.csv', '.txt', '.md',
        '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.eml',
      ];

      for (const file of filesToProcess) {
        if (!(file instanceof File) || file.size === 0) continue;
        if (file.size > MAX_FILE_SIZE_BYTES) continue;

        const ext = path.extname(file.name).toLowerCase() || '.bin';
        if (!ALLOWED_CHAT_EXTENSIONS.includes(ext)) continue;
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const docId = randomUUID();
        const storagePath = `uploads/${year}/${month}/${docId}${ext}`;

        // Write file to disk
        const uploadBase = path.isAbsolute(UPLOAD_DIR)
          ? UPLOAD_DIR
          : path.join(process.cwd(), UPLOAD_DIR);
        const absolutePath = path.join(uploadBase, year, month);
        await fs.mkdir(absolutePath, { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(path.join(absolutePath, `${docId}${ext}`), buffer);

        // Sanitize filename
        let cleanName = file.name.replace(/[/\\:\0]/g, '_');
        if (cleanName.length > 200) {
          const fileExt = path.extname(cleanName);
          cleanName = cleanName.substring(0, 200 - fileExt.length) + fileExt;
        }

        // Insert document record (chat_session_id set after session creation)
        const { data: newDoc } = await supabaseForFiles
          .from('documents')
          .insert({
            organization_id: orgId,
            filename: cleanName,
            original_filename: file.name,
            mime_type: file.type,
            file_size_bytes: file.size,
            storage_path: storagePath,
            source: 'upload',
            uploaded_by: 'user',
          })
          .select('id')
          .single();

        if (newDoc) {
          uploadedFiles.push({
            document_id: newDoc.id,
            filename: cleanName,
            mime_type: file.type,
            storage_path: storagePath,
          });
        }
      }
    } else {
      const body = await request.json();
      message = body.message || '';
      event_id = body.event_id;
      session_id = body.session_id;
      if (Object.prototype.hasOwnProperty.call(body, 'approved_tool_call_ids')) {
        hasToolApprovalPayload = true;
        if (!Array.isArray(body.approved_tool_call_ids)) {
          return NextResponse.json(
            { error: 'approved_tool_call_ids must be an array of tool call IDs' },
            { status: 400 }
          );
        }
        approvedToolCallIds = body.approved_tool_call_ids.map((id: unknown) => String(id));
      }
    }

    // Require either a message or files
    const hasMessage = typeof message === 'string' && message.trim().length > 0;
    const hasFiles = uploadedFiles.length > 0;
    if (!hasMessage && !hasFiles && !hasToolApprovalPayload) {
      return NextResponse.json({ error: 'Message or files required' }, { status: 400 });
    }
    if (hasToolApprovalPayload && !session_id) {
      return NextResponse.json({ error: 'session_id is required for tool approval responses' }, { status: 400 });
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
    let sessionContextTokens = 0;
    let existingContextSummary: string | null = null;

    if (!session_id) {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          organization_id: orgId,
          event_id: event_id || null,
          title: message.trim() ? message.slice(0, 100) : `File upload (${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''})`,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      session_id = newSession.id;
    } else {
      const { data: existingSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id, context_tokens_used, context_summary')
        .eq('id', session_id)
        .eq('organization_id', orgId)
        .single();

      if (sessionError || !existingSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      // Carry forward existing context state
      sessionContextTokens = existingSession.context_tokens_used ?? 0;
      existingContextSummary = existingSession.context_summary ?? null;
    }

    // ─── Link uploaded files to session ─────────────────────────────────
    if (uploadedFiles.length > 0 && session_id) {
      const docIds = uploadedFiles.map((f) => f.document_id);
      await supabase
        .from('documents')
        .update({ chat_session_id: session_id })
        .in('id', docIds);
    }

    // ─── Load conversation history ───────────────────────────────────────
    const { data: historyRows } = await supabase
      .from('chat_messages')
      .select('role, content, tool_calls, tool_results')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(50);

    // ─── Auto-compaction check ─────────────────────────────────────────
    let didCompact = false;
    let contextSummary: string | null = existingContextSummary;

    if (
      sessionContextTokens > CONTEXT_LIMIT * COMPACTION_THRESHOLD &&
      !existingContextSummary &&
      historyRows &&
      historyRows.length > 0
    ) {
      try {
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const compactionBaseUrl = `${protocol}://${host}`;
        contextSummary = await generateCompactionSummary(historyRows, apiKey, compactionBaseUrl);
        if (contextSummary) {
          await supabase
            .from('chat_sessions')
            .update({ context_summary: contextSummary })
            .eq('id', session_id);
          didCompact = true;
        }
      } catch (err) {
        console.error('Compaction summary generation failed:', err);
        // Continue without compaction — non-fatal
      }
    }

    // ─── Load agent settings ─────────────────────────────────────────────
    const { data: settings } = await supabase
      .from('agent_settings')
      .select('*')
      .eq('organization_id', orgId)
      .single();

    const agentName = settings?.agent_name || 'Ghostly';
    const agentFocus = settings?.agent_focus || null;
    const toolPermissions = (settings?.tool_permissions as Record<string, unknown> | null | undefined) ?? {};
    const chatModel = selectChatModel(settings as Record<string, unknown> | null | undefined, message);
    const customTemplate = typeof (settings as Record<string, unknown> | null)?.system_prompt_template === 'string'
      ? String((settings as Record<string, unknown>).system_prompt_template)
      : null;

    // ─── Load integration tools ─────────────────────────────────────────
    await ensureIntegrationsRegistered();
    const integrationTools = await getIntegrationTools(orgId);

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
      tools: [...agentTools, ...integrationTools],
      customTemplate,
    });

    // ─── Build messages array ────────────────────────────────────────────
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // ─── Recall semantic memory and prior learnings ─────────────────────
    if (!hasToolApprovalPayload && hasMessage) {
      const [memories, learnings] = await Promise.all([
        recallAgentMemories(orgId, message.trim(), 5),
        recallLearnings(orgId, message.trim(), 3),
      ]);

      if (learnings.length > 0 || memories.length > 0) {
        const sections: string[] = [
          '[Reference context from memory store]',
          'Use this only when relevant and do not treat it as authoritative over explicit user instructions in this run.',
        ];

        if (learnings.length > 0) {
          sections.push(
            'Prior learnings/corrections:',
            ...learnings.map((learning) => `- ${learning.correction}`)
          );
        }

        if (memories.length > 0) {
          sections.push(
            'Relevant past memory snippets:',
            ...memories.map((memory) => `- (${memory.source_type}) ${memory.content}`)
          );
        }

        messages.push({
          role: 'user',
          content: sections.join('\n'),
        });
      }
    }

    // If we have a context summary, inject it and only use recent history
    if (contextSummary) {
      messages.push({
        role: 'system',
        content: `[Previous conversation summary]\n${contextSummary}`,
      });
    }

    const historyToUse = contextSummary
      ? (historyRows ?? []).slice(-10)
      : (historyRows ?? []);

    // Add history
    for (const row of historyToUse) {
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

    if (!hasToolApprovalPayload) {
      // ─── Build user content with file context ──────────────────────────
      let userContent = message.trim();

      if (uploadedFiles.length > 0) {
        const fileContextParts: string[] = [];
        for (const uf of uploadedFiles) {
          if (isImageType(uf.mime_type)) {
            fileContextParts.push(`[Attached image: ${uf.filename}]`);
          } else {
            try {
              const text = await extractTextFromFile(uf.storage_path, uf.mime_type);
              fileContextParts.push(
                `--- Attached file: ${uf.filename} ---\n${text}\n--- End of file ---`
              );
            } catch {
              fileContextParts.push(`[Could not extract text from: ${uf.filename}]`);
            }
          }
        }
        const fileContext = fileContextParts.join('\n\n');
        userContent = userContent
          ? `${userContent}\n\n${fileContext}`
          : fileContext;
      }

      // Add the new user message
      messages.push({ role: 'user', content: userContent });

      // ─── Save the user message to DB ───────────────────────────────────
      const attachments = uploadedFiles.map((f) => ({
        document_id: f.document_id,
        filename: f.filename,
        mime_type: f.mime_type,
      }));

      await supabase.from('chat_messages').insert({
        session_id,
        role: 'user',
        content: message.trim() || (uploadedFiles.length > 0 ? `[${uploadedFiles.length} file(s) attached]` : ''),
        attachments: attachments.length > 0 ? attachments : [],
      });

      rememberAgentMemory({
        orgId,
        sourceType: 'chat_user',
        sourceId: session_id,
        content: userContent,
        metadata: {
          event_id: event_id || null,
        },
        ttlDays: 180,
      }).catch(() => {});

      const normalizedMessage = message.trim();
      if (/^(remember|note|correction)[:\\-\\s]/i.test(normalizedMessage) || /please remember/i.test(normalizedMessage)) {
        rememberLearning({
          orgId,
          topic: eventName || null,
          correction: normalizedMessage,
          metadata: { session_id },
        }).catch(() => {});
      }
    }

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

    // ─── Fire-and-forget summarization for non-image uploads ─────────────
    for (const file of uploadedFiles) {
      if (!isImageType(file.mime_type)) {
        fetch(`${baseUrl}/api/documents/${file.document_id}/summarize`, {
          method: 'POST',
          headers: {
            'Cookie': cookieHeader,
            'x-organization-id': orgId,
            'x-auth-type': 'cookie',
          },
        }).catch(() => {});
      }
    }

    const approvedToolCallIdSet = new Set(approvedToolCallIds);
    let pendingToolCalls = hasToolApprovalPayload
      ? findPendingToolCalls(
          (historyRows ?? []).map((row) => ({
            role: row.role,
            tool_calls: row.tool_calls,
            tool_results: row.tool_results,
          }))
        )
      : [];

    if (hasToolApprovalPayload && pendingToolCalls.length === 0) {
      return NextResponse.json(
        { error: 'No pending tool approval request found for this session' },
        { status: 409 }
      );
    }

    // ─── Tool-use loop ───────────────────────────────────────────────────
    const toolCallMessages: Array<{ role: string; content: string | null; tool_calls?: ToolCall[] }> = [];
    let finalContent = '';
    let toolRounds = 0;
    let lastPromptTokens = 0;

    const openRouterTools = toolsToOpenRouterFormat(integrationTools);

    while (toolRounds < MAX_TOOL_ROUNDS) {
      toolRounds++;

      let assistantMessage: { content?: string | null; tool_calls?: ToolCall[] } | null = null;
      let replayingPendingToolCalls = false;

      if (pendingToolCalls.length > 0) {
        assistantMessage = {
          content: null,
          tool_calls: pendingToolCalls,
        };
        pendingToolCalls = [];
        replayingPendingToolCalls = true;
      } else {
        const orResponse = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || baseUrl,
            'X-Title': 'Ghostly Agent',
          },
          body: JSON.stringify({
            model: chatModel,
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

        if (orData.usage?.prompt_tokens) {
          lastPromptTokens = orData.usage.prompt_tokens;
        }

        const choice = orData.choices?.[0];
        if (!choice) {
          finalContent = 'I received an unexpected response. Please try again.';
          break;
        }

        assistantMessage = choice.message;
      }

      if (!assistantMessage) {
        finalContent = 'I received an unexpected response. Please try again.';
        break;
      }

      // If there are tool calls, execute them
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        const isApprovalReplay = replayingPendingToolCalls && hasToolApprovalPayload;

        if (!replayingPendingToolCalls) {
          messages.push({
            role: 'assistant',
            content: assistantMessage.content || null,
            tool_calls: assistantMessage.tool_calls,
          });

          await supabase.from('chat_messages').insert({
            session_id,
            role: 'assistant',
            content: assistantMessage.content || null,
            tool_calls: assistantMessage.tool_calls as unknown as Record<string, unknown>[],
          });
        }

        const askToolCalls = assistantMessage.tool_calls.filter(
          (tc) => getToolPermissionMode(tc.function.name, toolPermissions, integrationTools) === 'ask'
        );

        if (askToolCalls.length > 0 && !isApprovalReplay) {
          if (lastPromptTokens > 0) {
            await supabase
              .from('chat_sessions')
              .update({ context_tokens_used: lastPromptTokens })
              .eq('id', session_id);
          }

          const approvalCalls = askToolCalls.map((tc) => {
            const tool = findTool(tc.function.name, integrationTools);
            return {
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
              description: tool?.description ?? tc.function.name,
            };
          });

          const encoder = new TextEncoder();
          const approvalStream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'session', session_id })}\n\n`)
              );

              const contextPercent = CONTEXT_LIMIT > 0
                ? Math.round((lastPromptTokens / CONTEXT_LIMIT) * 100)
                : 0;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'context',
                  used: lastPromptTokens,
                  limit: CONTEXT_LIMIT,
                  percent: contextPercent,
                })}\n\n`)
              );

              if (didCompact) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'compacted' })}\n\n`)
                );
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'approval_required',
                  session_id,
                  message: assistantMessage?.content || null,
                  tool_calls: approvalCalls,
                })}\n\n`)
              );

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'done', session_id })}\n\n`)
              );
              controller.close();
            },
          });

          return new Response(approvalStream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        }

        const toolResults: Array<{
          tool_call_id: string;
          name: string;
          content: string;
        }> = [];

        for (const tc of assistantMessage.tool_calls) {
          const toolName = tc.function.name;
          const tool = findTool(toolName, integrationTools);
          const mode = getToolPermissionMode(toolName, toolPermissions, integrationTools);

          let resultContent: string;
          if (mode === 'never') {
            resultContent = JSON.stringify({ error: `Tool "${toolName}" is disabled by policy.` });
          } else if (mode === 'ask' && (!isApprovalReplay || !approvedToolCallIdSet.has(tc.id))) {
            resultContent = JSON.stringify({ error: `Permission denied for tool "${toolName}".` });
          } else if (!tool) {
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

    rememberAgentMemory({
      orgId,
      sourceType: 'chat_assistant',
      sourceId: session_id,
      content: finalContent,
      metadata: {
        tool_rounds: toolRounds,
        event_id: event_id || null,
      },
      ttlDays: 180,
    }).catch(() => {});

    if (lastPromptTokens > 0) {
      await supabase
        .from('chat_sessions')
        .update({ context_tokens_used: lastPromptTokens })
        .eq('id', session_id);
    }

    // ─── Stream the response via SSE ─────────────────────────────────────
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send session_id first
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'session', session_id })}\n\n`)
        );

        // Send context usage info
        const contextPercent = CONTEXT_LIMIT > 0
          ? Math.round((lastPromptTokens / CONTEXT_LIMIT) * 100)
          : 0;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'context',
            used: lastPromptTokens,
            limit: CONTEXT_LIMIT,
            percent: contextPercent,
          })}\n\n`)
        );

        // Send compaction event if context was compacted this round
        if (didCompact) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'compacted' })}\n\n`)
          );
        }

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
