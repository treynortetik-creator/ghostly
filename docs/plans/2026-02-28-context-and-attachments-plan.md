# Context Window Management & Chat File Attachments — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add context window tracking with auto-compaction at 80%, file upload support in the agent chat (paperclip + drag-and-drop), and document intelligence tools so the agent can manage and reference files.

**Architecture:** Three independent phases. Phase A adds token tracking from OpenRouter responses, a context bar UI, and auto-compaction logic. Phase B expands the document storage system to support all common file types and wires file uploads into the chat panel. Phase C adds AI-powered document summarization and agent tools for document management.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), OpenRouter API (Claude Sonnet 4), TypeScript, Tailwind CSS, SSE streaming.

---

## Phase A: Context Window Management

### Task 1: Database Migration — Session Context Fields

**Files:**
- Create: `supabase/migrations/028_session_context.sql`

**Step 1: Write the migration**

```sql
-- Add context tracking fields to chat_sessions
ALTER TABLE chat_sessions
  ADD COLUMN context_tokens_used integer NOT NULL DEFAULT 0,
  ADD COLUMN context_summary text;

-- Index for finding sessions that need compaction
CREATE INDEX idx_chat_sessions_context ON chat_sessions (context_tokens_used)
  WHERE context_tokens_used > 0;
```

**Step 2: Apply the migration**

Run via Supabase MCP `apply_migration` tool with name `session_context`.

**Step 3: Verify**

Run `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chat_sessions' AND column_name IN ('context_tokens_used', 'context_summary');` — should return both columns.

**Step 4: Commit**

```bash
git add supabase/migrations/028_session_context.sql
git commit -m "feat: add context tracking columns to chat_sessions"
```

---

### Task 2: Capture Token Usage from OpenRouter

**Files:**
- Modify: `src/app/api/agent/chat/route.ts`

The OpenRouter response includes `usage.prompt_tokens` and `usage.completion_tokens`. Capture this after each LLM call and update the session.

**Step 1: Add usage tracking variables**

After line 205 (`let toolRounds = 0;`), add:

```typescript
let lastPromptTokens = 0;
```

**Step 2: Capture usage from OpenRouter response**

After line 237 (`const orData = await orResponse.json();`), add:

```typescript
// Capture token usage
if (orData.usage?.prompt_tokens) {
  lastPromptTokens = orData.usage.prompt_tokens;
}
```

**Step 3: Update session with token count after the tool loop**

After the final assistant message is saved to DB (after line 335), add:

```typescript
// Update session with latest token usage
if (lastPromptTokens > 0) {
  await supabase
    .from('chat_sessions')
    .update({ context_tokens_used: lastPromptTokens })
    .eq('id', session_id);
}
```

**Step 4: Stream context info to client**

In the SSE stream `start(controller)` function (after the session event, around line 344), add:

```typescript
// Send context usage info
const contextLimit = 196000; // 200K minus 4K output
const contextPercent = contextLimit > 0
  ? Math.round((lastPromptTokens / contextLimit) * 100)
  : 0;
controller.enqueue(
  encoder.encode(`data: ${JSON.stringify({
    type: 'context',
    used: lastPromptTokens,
    limit: contextLimit,
    percent: contextPercent,
  })}\n\n`)
);
```

**Step 5: Commit**

```bash
git add src/app/api/agent/chat/route.ts
git commit -m "feat: capture and stream token usage from OpenRouter"
```

---

### Task 3: Context Bar UI in ChatPanel

**Files:**
- Modify: `src/components/agent/ChatPanel.tsx`

**Step 1: Add SSEEvent type for context**

Update the `SSEEvent` interface (line 59) to include the new event type:

```typescript
interface SSEEvent {
  type: "session" | "tool_call" | "text" | "done" | "context" | "compacted";
  session_id?: string;
  content?: string;
  name?: string;
  arguments?: string;
  // Context tracking
  used?: number;
  limit?: number;
  percent?: number;
}
```

**Step 2: Add context state**

After line 155 (`const [agentName, setAgentName] = useState("Ghostly");`), add:

```typescript
const [contextPercent, setContextPercent] = useState(0);
const [showCompactedDivider, setShowCompactedDivider] = useState(false);
```

**Step 3: Handle context SSE event**

In the SSE event parsing loop (around line 298), add a case after the `tool_call` handler:

```typescript
} else if (event.type === "context") {
  if (event.percent !== undefined) {
    setContextPercent(event.percent);
  }
} else if (event.type === "compacted") {
  setShowCompactedDivider(true);
  setContextPercent(event.percent ?? 0);
```

**Step 4: Add context bar component**

After the header div (after line 460, after the closing `</div>` of the header), add:

```tsx
{/* Context usage bar */}
{contextPercent >= 50 && (
  <div className="shrink-0 px-0" title={`Context: ${contextPercent}% — auto-compacts at 80%`}>
    <div className="h-0.5 w-full bg-border/30">
      <div
        className={`h-full transition-all duration-500 ease-out ${
          contextPercent >= 80
            ? "bg-red-500"
            : contextPercent >= 65
              ? "bg-amber-400"
              : "bg-emerald-400"
        }`}
        style={{ width: `${Math.min(contextPercent, 100)}%` }}
      />
    </div>
  </div>
)}
```

**Step 5: Add compaction divider in messages area**

In the messages area (around line 549, before `{messages.map(renderMessage)}`), add:

```tsx
{showCompactedDivider && (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 border-t border-spectral/20" />
    <span className="text-[10px] text-spectral/60 font-medium whitespace-nowrap">
      Context refreshed — summary retained
    </span>
    <div className="flex-1 border-t border-spectral/20" />
  </div>
)}
```

Reset the divider when starting a new chat — in `startNewChat()` (line 217), add:

```typescript
setShowCompactedDivider(false);
setContextPercent(0);
```

**Step 6: Commit**

```bash
git add src/components/agent/ChatPanel.tsx
git commit -m "feat: add context usage bar and compaction divider to ChatPanel"
```

---

### Task 4: Auto-Compaction Logic

**Files:**
- Modify: `src/app/api/agent/chat/route.ts`

**Step 1: Add compaction constants and helper**

After `const MAX_TOOL_ROUNDS = 8;` (line 52), add:

```typescript
const CONTEXT_LIMIT = 196000; // 200K window minus 4K output
const COMPACTION_THRESHOLD = 0.80; // 80%

/**
 * Generate a compaction summary of the conversation so far.
 */
async function generateCompactionSummary(
  messages: ChatMessage[],
  apiKey: string,
  baseUrl: string,
): Promise<string> {
  // Filter to user/assistant messages only (skip system, tool)
  const conversationText = messages
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || baseUrl,
      'X-Title': 'Ghostly Agent - Compaction',
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a conversation summarizer. Produce a concise summary that preserves all key facts, decisions, pending items, file/document references, and action items. Use bullet points. Keep under 500 words.',
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${conversationText}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate compaction summary');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Unable to generate summary.';
}
```

**Step 2: Add compaction check before building messages**

After loading conversation history (after line 112, the `.limit(50)` query), add compaction logic:

```typescript
// Check if we need to compact the context
let contextSummary: string | null = null;
let didCompact = false;

// Load existing summary if available
const { data: sessionData } = await supabase
  .from('chat_sessions')
  .select('context_tokens_used, context_summary')
  .eq('id', session_id)
  .single();

if (sessionData?.context_summary) {
  contextSummary = sessionData.context_summary;
}

// Check if we should compact based on last known token usage
if (sessionData?.context_tokens_used > CONTEXT_LIMIT * COMPACTION_THRESHOLD && !contextSummary) {
  try {
    // Build temp messages to summarize
    const tempMessages: ChatMessage[] = (historyRows ?? [])
      .filter((r) => r.role === 'user' || r.role === 'assistant')
      .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content || '' }));

    contextSummary = await generateCompactionSummary(tempMessages, apiKey, baseUrl);
    didCompact = true;

    // Save summary to session
    await supabase
      .from('chat_sessions')
      .update({ context_summary: contextSummary })
      .eq('id', session_id);
  } catch (err) {
    console.error('Compaction failed:', err);
    // Continue without compaction
  }
}
```

**Step 3: Use summary in messages array when available**

Modify the message building section (around line 146). After adding the system message, add:

```typescript
// If we have a compaction summary, use it instead of full history
if (contextSummary) {
  messages.push({
    role: 'system',
    content: `## Conversation Summary (from earlier in this session)\n${contextSummary}`,
  });

  // Only include the last 10 messages for recent context
  const recentHistory = (historyRows ?? []).slice(-10);
  for (const row of recentHistory) {
    // ... same history reconstruction logic as existing code
  }
} else {
  // Original history loop — no changes
  for (const row of historyRows ?? []) {
    // ... existing code
  }
}
```

This replaces the existing `for (const row of historyRows ?? [])` loop with a conditional that uses either the summary + recent messages, or the full history.

**Step 4: Stream compacted event**

In the SSE stream, after the context event, add:

```typescript
if (didCompact) {
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({
      type: 'compacted',
      percent: contextPercent,
    })}\n\n`)
  );
}
```

**Step 5: Commit**

```bash
git add src/app/api/agent/chat/route.ts
git commit -m "feat: auto-compact conversation context at 80% threshold"
```

---

### Task 5: Session History Search Tool

**Files:**
- Create: `src/app/api/agent/tools/session-history/route.ts`
- Modify: `src/lib/agent/tools.ts`

**Step 1: Create the API endpoint**

```typescript
/**
 * GET /api/agent/tools/session-history
 *
 * Search past chat messages across sessions.
 * Query params: session_id (optional), search (optional), limit (default 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'agent-sessions' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const supabase = await createClient();

    // Build query — join through chat_sessions for org scoping
    let query = supabase
      .from('chat_messages')
      .select('id, role, content, created_at, session_id, chat_sessions!inner(title, organization_id)')
      .eq('chat_sessions.organization_id', orgId)
      .in('role', ['user', 'assistant'])
      .not('content', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    if (search) {
      query = query.ilike('content', `%${search}%`);
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    const results = (messages ?? []).map((m: Record<string, unknown>) => {
      const session = m.chat_sessions as Record<string, unknown> | null;
      return {
        message_id: m.id,
        session_id: m.session_id,
        session_title: session?.title || 'Untitled',
        role: m.role,
        content: (m.content as string)?.slice(0, 500) || '',
        created_at: m.created_at,
      };
    });

    return NextResponse.json({ messages: results, total: results.length });
  }
);
```

**Step 2: Add the tool to tools.ts**

Append to the `agentTools` array in `src/lib/agent/tools.ts` (before the closing `];` on line 454):

```typescript
  // 11. get_session_history
  {
    name: 'get_session_history',
    description:
      'Search past chat messages across previous sessions. Use this to recall earlier conversations or find specific information discussed previously.',
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'Optional: limit to a specific session UUID',
        },
        search: {
          type: 'string',
          description: 'Keyword search within message content',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 20, max 50)',
        },
      },
    },
    execute: async (args, ctx) => {
      const params = new URLSearchParams();
      if (args.session_id) params.set('session_id', String(args.session_id));
      if (args.search) params.set('search', String(args.search));
      if (args.limit) params.set('limit', String(args.limit));
      const result = await internalFetch(ctx, 'GET', `/api/agent/tools/session-history?${params.toString()}`);
      return JSON.stringify(result, null, 2);
    },
  },
```

**Step 3: Commit**

```bash
git add src/app/api/agent/tools/session-history/route.ts src/lib/agent/tools.ts
git commit -m "feat: add get_session_history tool for agent context recall"
```

---

### Task 6: Build & Verify Phase A

**Step 1: Run the build**

```bash
npx next build
```

Expected: Clean build, no errors.

**Step 2: Commit any lint fixes**

```bash
git add -A && git commit -m "chore: lint fixes for phase A"
```

---

## Phase B: File Attachments in Chat

### Task 7: Database Migration — Attachments & Document Columns

**Files:**
- Create: `supabase/migrations/029_chat_attachments.sql`

**Step 1: Write the migration**

```sql
-- Add attachments field to chat_messages
ALTER TABLE chat_messages
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]';

-- Add AI metadata and chat session link to documents
ALTER TABLE documents
  ADD COLUMN ai_summary text,
  ADD COLUMN ai_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN chat_session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL;

-- Index for finding documents by chat session
CREATE INDEX idx_documents_chat_session ON documents (chat_session_id)
  WHERE chat_session_id IS NOT NULL;

-- Relax the XOR constraint: allow both null (unlinked/misc bucket)
-- and allow linking to both event and expense
-- Drop existing constraint if it exists
DO $$
BEGIN
  -- Check for the constraint and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_link_xor'
    AND conrelid = 'documents'::regclass
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT documents_link_xor;
  END IF;
END
$$;
```

**Step 2: Apply the migration**

Run via Supabase MCP `apply_migration` tool with name `chat_attachments`.

**Step 3: Verify**

Run SQL to confirm new columns exist on both tables.

**Step 4: Commit**

```bash
git add supabase/migrations/029_chat_attachments.sql
git commit -m "feat: add attachments column, document AI fields, relax XOR constraint"
```

---

### Task 8: Expand Allowed File Types

**Files:**
- Modify: `src/app/api/documents/route.ts`
- Modify: `src/components/documents/DocumentUpload.tsx`

**Step 1: Update server-side ALLOWED_MIME_TYPES and magic bytes**

Replace the `ALLOWED_MIME_TYPES`, `ALLOWED_EXTENSIONS`, and `verifyMagicBytes` in `src/app/api/documents/route.ts` (lines 19-61):

```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'message/rfc822',
];

const ALLOWED_EXTENSIONS = [
  '.pdf', '.docx', '.xlsx', '.csv',
  '.txt', '.md', '.json',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.eml',
];

// Magic bytes for file type verification
const MAGIC_BYTES: Record<string, Uint8Array> = {
  '.pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46]),   // %PDF
  '.docx': new Uint8Array([0x50, 0x4b, 0x03, 0x04]),   // PK (ZIP)
  '.xlsx': new Uint8Array([0x50, 0x4b, 0x03, 0x04]),   // PK (ZIP)
  '.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),    // PNG
  '.jpg': new Uint8Array([0xff, 0xd8, 0xff]),           // JPEG
  '.jpeg': new Uint8Array([0xff, 0xd8, 0xff]),          // JPEG
  '.gif': new Uint8Array([0x47, 0x49, 0x46]),           // GIF
};

function verifyMagicBytes(buffer: Buffer, ext: string): boolean {
  // Text-based formats don't have magic bytes — skip verification
  const textTypes = ['.csv', '.txt', '.md', '.json', '.eml', '.webp'];
  if (textTypes.includes(ext)) return true;

  const expected = MAGIC_BYTES[ext];
  if (!expected) return true; // Unknown type — allow
  if (buffer.length < expected.length) return false;

  const header = new Uint8Array(buffer.slice(0, expected.length));
  return header.every((b, i) => b === expected[i]);
}
```

**Step 2: Update the error message for invalid types**

Replace the error message on line 201:

```typescript
{ error: `Invalid file type. Allowed: PDF, DOCX, XLSX, CSV, TXT, MD, JSON, PNG, JPG, GIF, WebP, EML.` },
```

**Step 3: Remove the XOR constraint check**

Remove lines 206-212 (the `if (eventId && expenseId)` check) since we relaxed the constraint.

**Step 4: Update DocumentUpload.tsx client-side validation**

In `src/components/documents/DocumentUpload.tsx`, update `ALLOWED_TYPES` (line 13) and the file input `accept` attribute (line 180):

```typescript
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "message/rfc822",
];

const ALLOWED_EXTENSIONS = [
  "pdf", "docx", "xlsx", "csv", "txt", "md", "json",
  "png", "jpg", "jpeg", "gif", "webp", "eml",
];
```

Update `validateFile` to check both MIME type and extension:

```typescript
const validateFile = (file: File): string | null => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext || "")) {
    return "Invalid file type. Allowed: PDF, DOCX, XLSX, CSV, TXT, MD, JSON, PNG, JPG, GIF, WebP, EML.";
  }
  if (file.size > MAX_SIZE) {
    return "File too large. Maximum size is 10 MB.";
  }
  if (file.size === 0) {
    return "File is empty.";
  }
  return null;
};
```

Update the file input `accept` attribute:

```tsx
accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp,.eml"
```

Update the help text:

```tsx
<p className="text-xs text-muted-foreground/60 mt-1">
  PDF, DOCX, XLSX, CSV, images, and more — max 10 MB
</p>
```

**Step 5: Commit**

```bash
git add src/app/api/documents/route.ts src/components/documents/DocumentUpload.tsx
git commit -m "feat: expand allowed file types for documents"
```

---

### Task 9: File Processing Utilities

**Files:**
- Create: `src/lib/agent/file-processor.ts`

**Step 1: Create the file processing module**

This module extracts text content from various file types for the AI agent.

```typescript
/**
 * Ghostly Agent - File Processor
 *
 * Extracts text content from uploaded files for AI processing.
 * Each file type has a dedicated handler that returns plain text.
 */

import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';

function getUploadBasePath(): string {
  if (path.isAbsolute(UPLOAD_DIR)) return UPLOAD_DIR;
  return path.join(process.cwd(), UPLOAD_DIR);
}

/**
 * Extract text content from a document stored on disk.
 */
export async function extractTextFromFile(
  storagePath: string,
  mimeType: string,
): Promise<string> {
  const absolutePath = path.join(getUploadBasePath(), storagePath.replace(/^uploads\//, ''));
  const buffer = await fs.readFile(absolutePath);

  switch (mimeType) {
    case 'text/plain':
    case 'text/markdown':
    case 'text/csv':
    case 'application/json':
      return buffer.toString('utf-8').slice(0, 50000); // Limit to ~50K chars

    case 'message/rfc822':
      return parseEml(buffer.toString('utf-8'));

    case 'application/pdf':
      return extractPdfText(buffer);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocxText(buffer);

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return extractXlsxText(buffer);

    case 'image/png':
    case 'image/jpeg':
    case 'image/gif':
    case 'image/webp':
      // Images are handled via vision API, not text extraction
      return '[Image file — use vision API for content]';

    default:
      return '[Unsupported file type for text extraction]';
  }
}

/**
 * Parse .eml file — extract headers and body text.
 */
function parseEml(content: string): string {
  const lines = content.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      bodyStart = i + 1;
      break;
    }
    const match = line.match(/^(From|To|Subject|Date|Cc|Bcc):\s*(.+)/i);
    if (match) {
      headers[match[1]] = match[2];
    }
  }

  const body = lines.slice(bodyStart).join('\n').trim();

  const headerText = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  return `${headerText}\n\n---\n\n${body}`.slice(0, 50000);
}

/**
 * Basic PDF text extraction — reads text objects from PDF.
 * For full fidelity, a library like pdf-parse would be better,
 * but this handles most text-based PDFs without dependencies.
 */
function extractPdfText(buffer: Buffer): string {
  // Use a simple regex approach to extract text from PDF streams
  const content = buffer.toString('latin1');
  const textParts: string[] = [];

  // Match text between BT and ET (Begin Text / End Text)
  const textBlocks = content.match(/BT[\s\S]*?ET/g) || [];
  for (const block of textBlocks) {
    // Extract text from Tj and TJ operators
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || [];
    for (const m of tjMatches) {
      const text = m.replace(/\(([^)]*)\)\s*Tj/, '$1');
      textParts.push(text);
    }
  }

  const extracted = textParts.join(' ').trim();
  if (extracted.length > 100) {
    return extracted.slice(0, 50000);
  }

  // Fallback: try to find readable text in the buffer
  const readable = content.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return readable.length > 100
    ? `[Partial PDF text extraction]\n${readable.slice(0, 50000)}`
    : '[PDF text extraction failed — document may be image-based. Consider using OCR.]';
}

/**
 * Basic DOCX text extraction — reads from XML content in the ZIP.
 */
function extractDocxText(buffer: Buffer): string {
  // DOCX is a ZIP file containing XML
  // Simple approach: find word/document.xml content and strip tags
  const content = buffer.toString('utf-8');

  // Look for text content between XML tags
  const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const text = textMatches
    .map((m) => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
    .join(' ')
    .trim();

  return text.length > 0 ? text.slice(0, 50000) : '[DOCX text extraction failed]';
}

/**
 * Basic XLSX text extraction — finds shared strings in the ZIP.
 */
function extractXlsxText(buffer: Buffer): string {
  const content = buffer.toString('utf-8');

  // XLSX stores strings in sharedStrings.xml
  const stringMatches = content.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
  const text = stringMatches
    .map((m) => m.replace(/<t[^>]*>([^<]*)<\/t>/, '$1'))
    .join(', ')
    .trim();

  return text.length > 0 ? text.slice(0, 50000) : '[XLSX text extraction failed]';
}

/**
 * Check if a MIME type is an image type (handled via vision API).
 */
export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Convert a file buffer to a base64 data URL for vision API.
 */
export function fileToBase64DataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
```

**Step 2: Commit**

```bash
git add src/lib/agent/file-processor.ts
git commit -m "feat: add file processing utilities for text extraction"
```

---

### Task 10: Update Chat API for File Uploads

**Files:**
- Modify: `src/app/api/agent/chat/route.ts`

The chat API needs to accept multipart form data instead of JSON when files are attached.

**Step 1: Add file processing imports**

At the top of the file, add:

```typescript
import { extractTextFromFile, isImageType, fileToBase64DataUrl } from '@/lib/agent/file-processor';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants';
```

**Step 2: Update the request body parsing**

Replace the body parsing section (lines 61-67) to handle both JSON and multipart:

```typescript
let message: string;
let event_id: string | undefined;
let session_id: string | undefined;
let uploadedFiles: Array<{ documentId: string; filename: string; mimeType: string; storagePath: string }> = [];

const contentType = request.headers.get('content-type') || '';

if (contentType.includes('multipart/form-data')) {
  const formData = await request.formData();
  message = (formData.get('message') as string) || '';
  event_id = (formData.get('event_id') as string) || undefined;
  session_id = (formData.get('session_id') as string) || undefined;

  // Process uploaded files (max 5)
  const files = formData.getAll('files') as File[];
  const filesToProcess = files.slice(0, 5);

  const supabaseForUpload = await createClient();
  const uploadOrgId = getOrgId(request);

  for (const file of filesToProcess) {
    if (!file || !(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_FILE_SIZE_BYTES) continue;

    const ext = path.extname(file.name).toLowerCase();
    const docId = randomUUID();
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const storagePath = `uploads/${year}/${month}/${docId}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';
    const basePath = path.isAbsolute(uploadDir) ? uploadDir : path.join(process.cwd(), uploadDir);
    const absolutePath = path.join(basePath, year, month);
    await fs.mkdir(absolutePath, { recursive: true });
    await fs.writeFile(path.join(absolutePath, `${docId}${ext}`), buffer);

    const { data: doc } = await supabaseForUpload
      .from('documents')
      .insert({
        organization_id: uploadOrgId,
        filename: file.name.replace(/[/\\:\0]/g, '_').slice(0, 200),
        original_filename: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        storage_path: storagePath,
        source: 'upload',
        uploaded_by: 'user',
        chat_session_id: session_id || null,
      })
      .select('id')
      .single();

    if (doc) {
      uploadedFiles.push({
        documentId: doc.id,
        filename: file.name,
        mimeType: file.type,
        storagePath,
      });
    }
  }
} else {
  const body = await request.json();
  message = body.message;
  event_id = body.event_id;
  session_id = body.session_id;
}

if ((!message || typeof message !== 'string' || message.trim().length === 0) && uploadedFiles.length === 0) {
  return NextResponse.json({ error: 'Message or file is required' }, { status: 400 });
}
```

**Step 3: Include file content in the user message**

After saving the user message to DB (around line 184), modify to include attachments:

```typescript
// Save the user message to DB with attachments
const attachments = uploadedFiles.map((f) => ({
  document_id: f.documentId,
  filename: f.filename,
  mime_type: f.mimeType,
}));

await supabase.from('chat_messages').insert({
  session_id,
  role: 'user',
  content: message.trim() || null,
  attachments: attachments.length > 0 ? attachments : [],
});

// Build the user message content with file context
let userContent = message.trim();

for (const file of uploadedFiles) {
  if (isImageType(file.mimeType)) {
    // Images will be sent as vision content blocks — skip text here
    userContent += `\n\n[Attached image: ${file.filename}]`;
  } else {
    try {
      const extractedText = await extractTextFromFile(file.storagePath, file.mimeType);
      userContent += `\n\n--- Attached file: ${file.filename} ---\n${extractedText}\n--- End of file ---`;
    } catch {
      userContent += `\n\n[Attached file: ${file.filename} — could not extract text]`;
    }
  }
}

messages.push({ role: 'user', content: userContent });
```

Note: For images, Claude supports vision via content blocks with `type: 'image_url'`. This requires a different message format for the OpenRouter call. For the initial implementation, we include a text note about the image. Full vision support can be added as an enhancement.

**Step 4: Update session link for uploaded files**

After the session is created/loaded (around line 104), update uploaded files with the session ID:

```typescript
// Link uploaded files to this session
if (uploadedFiles.length > 0 && session_id) {
  for (const file of uploadedFiles) {
    await supabase
      .from('documents')
      .update({ chat_session_id: session_id })
      .eq('id', file.documentId);
  }
}
```

**Step 5: Commit**

```bash
git add src/app/api/agent/chat/route.ts
git commit -m "feat: accept file uploads in chat API via multipart form"
```

---

### Task 11: ChatPanel UI — Paperclip & Drag-and-Drop

**Files:**
- Modify: `src/components/agent/ChatPanel.tsx`

**Step 1: Add imports**

Add to the lucide-react imports (line 12):

```typescript
import { Paperclip } from "lucide-react";
```

**Step 2: Add file attachment state**

After the existing state declarations (around line 155), add:

```typescript
const [pendingFiles, setPendingFiles] = useState<File[]>([]);
const [isDragOver, setIsDragOver] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
```

**Step 3: Add drag-and-drop handlers**

After `handleKeyDown` (around line 356), add:

```typescript
const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragOver(true);
}, []);

const handleDragLeave = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragOver(false);
}, []);

const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragOver(false);

  const files = Array.from(e.dataTransfer.files)
    .filter((f) => f.size <= MAX_FILE_SIZE && f.size > 0)
    .slice(0, MAX_FILES);

  if (files.length > 0) {
    setPendingFiles((prev) => [...prev, ...files].slice(0, MAX_FILES));
  }
}, []);

const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || [])
    .filter((f) => f.size <= MAX_FILE_SIZE && f.size > 0)
    .slice(0, MAX_FILES);

  if (files.length > 0) {
    setPendingFiles((prev) => [...prev, ...files].slice(0, MAX_FILES));
  }
  if (fileInputRef.current) fileInputRef.current.value = "";
};

const removePendingFile = (index: number) => {
  setPendingFiles((prev) => prev.filter((_, i) => i !== index));
};
```

**Step 4: Update sendMessage to use FormData when files present**

Replace the fetch call in `sendMessage` (around line 257) to handle files:

```typescript
let res: Response;

if (pendingFiles.length > 0) {
  const formData = new FormData();
  formData.append('message', trimmed);
  if (currentSessionId) formData.append('session_id', currentSessionId);
  if (eventId) formData.append('event_id', eventId);
  for (const file of pendingFiles) {
    formData.append('files', file);
  }
  res = await fetch("/api/agent/chat", {
    method: "POST",
    body: formData,
  });
  setPendingFiles([]);
} else {
  res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: currentSessionId,
      message: trimmed,
      event_id: eventId,
    }),
  });
}
```

**Step 5: Add drag overlay to the panel**

Wrap the main panel div with drag handlers. On the outer panel div (line 410), add:

```tsx
onDragOver={handleDragOver}
onDragLeave={handleDragLeave}
onDrop={handleDrop}
```

Inside the panel, after the header section, add the drag overlay:

```tsx
{/* Drag overlay */}
{isDragOver && (
  <div className="absolute inset-0 z-50 bg-spectral/10 backdrop-blur-sm border-2 border-dashed border-spectral rounded-lg flex items-center justify-center">
    <div className="text-center">
      <Paperclip className="w-10 h-10 text-spectral mx-auto mb-2" />
      <p className="text-sm font-medium text-spectral">Drop files here</p>
      <p className="text-xs text-spectral/60 mt-1">Max 5 files, 10 MB each</p>
    </div>
  </div>
)}
```

**Step 6: Add pending files preview and paperclip button in input area**

In the input area (around line 589), add pending files preview above the textarea and the paperclip button:

```tsx
<div className="border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3 shrink-0">
  {/* Pending files */}
  {pendingFiles.length > 0 && (
    <div className="flex flex-wrap gap-2 mb-2">
      {pendingFiles.map((file, i) => (
        <div
          key={`${file.name}-${i}`}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-spectral/10 border border-spectral/20 text-xs"
        >
          <Paperclip className="w-3 h-3 text-spectral" />
          <span className="text-foreground truncate max-w-[120px]">{file.name}</span>
          <button
            onClick={() => removePendingFile(i)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )}

  <div className="flex items-end gap-2">
    {/* Paperclip button */}
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={isStreaming || pendingFiles.length >= MAX_FILES}
      className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-spectral/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      title="Attach files"
    >
      <Paperclip className="w-4 h-4" />
    </button>
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp,.eml"
      onChange={handleFileSelect}
      className="hidden"
    />

    <textarea ... />  {/* existing textarea */}
    <button ... />    {/* existing send button */}
  </div>

  {/* existing powered by text */}
</div>
```

Also update the send button disabled check to allow sending with just files:

```tsx
disabled={(!input.trim() && pendingFiles.length === 0) || isStreaming}
```

**Step 7: Clear pending files on new chat**

In `startNewChat()`, add:

```typescript
setPendingFiles([]);
```

**Step 8: Commit**

```bash
git add src/components/agent/ChatPanel.tsx
git commit -m "feat: add paperclip button and drag-and-drop file uploads to ChatPanel"
```

---

### Task 12: Build & Verify Phase B

**Step 1: Run the build**

```bash
npx next build
```

Expected: Clean build.

**Step 2: Commit any fixes**

```bash
git add -A && git commit -m "chore: lint fixes for phase B"
```

---

## Phase C: Document Intelligence

### Task 13: Document Summarization Endpoint

**Files:**
- Create: `src/app/api/documents/[id]/summarize/route.ts`

**Step 1: Create the endpoint**

```typescript
/**
 * POST /api/documents/[id]/summarize
 *
 * Generate an AI summary and tags for a document.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { extractTextFromFile } from '@/lib/agent/file-processor';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

export const POST = withApiHandler(
  { permission: 'write', resource: 'documents' },
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const orgId = getOrgId(request);
    const supabase = await createClient();

    // Fetch document
    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, storage_path, mime_type, filename, ai_summary')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Skip if already summarized
    if (doc.ai_summary) {
      return NextResponse.json({
        summary: doc.ai_summary,
        message: 'Document already summarized',
      });
    }

    // Extract text
    let extractedText: string;
    try {
      extractedText = await extractTextFromFile(doc.storage_path, doc.mime_type);
    } catch {
      return NextResponse.json(
        { error: 'Could not extract text from this document' },
        { status: 422 }
      );
    }

    if (extractedText.startsWith('[') && extractedText.endsWith(']')) {
      return NextResponse.json(
        { error: 'Could not extract meaningful text from this document' },
        { status: 422 }
      );
    }

    // Generate summary via OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Ghostly - Document Summarizer',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          {
            role: 'system',
            content: `You are a document analyzer for an event management platform. Given a document's text content, produce:
1. A 2-3 sentence summary of what this document contains and its relevance.
2. 3-5 keyword tags (single words or short phrases).

Respond in this exact JSON format:
{"summary": "...", "tags": ["tag1", "tag2", "tag3"]}`,
          },
          {
            role: 'user',
            content: `Filename: ${doc.filename}\n\nDocument content:\n${extractedText.slice(0, 10000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: 502 }
      );
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';

    let summary = '';
    let tags: string[] = [];

    try {
      const parsed = JSON.parse(aiContent);
      summary = parsed.summary || '';
      tags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [];
    } catch {
      // If JSON parsing fails, use the raw content as summary
      summary = aiContent.slice(0, 500);
    }

    // Save to document
    await supabase
      .from('documents')
      .update({ ai_summary: summary, ai_tags: tags })
      .eq('id', id);

    return NextResponse.json({ summary, tags });
  }
);
```

**Step 2: Commit**

```bash
git add src/app/api/documents/[id]/summarize/route.ts
git commit -m "feat: add document AI summarization endpoint"
```

---

### Task 14: Agent Document Tools

**Files:**
- Create: `src/app/api/agent/tools/event-documents/route.ts`
- Create: `src/app/api/agent/tools/read-document/route.ts`
- Create: `src/app/api/agent/tools/attach-document/route.ts`
- Modify: `src/lib/agent/tools.ts`

**Step 1: Create event-documents endpoint**

```typescript
/**
 * GET /api/agent/tools/event-documents?event_id=xxx
 *
 * List documents for an event with AI summaries and tags.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const GET = withApiHandler({ permission: 'read', resource: 'documents' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, filename, mime_type, file_size_bytes, ai_summary, ai_tags, created_at')
      .eq('organization_id', orgId)
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      documents: docs ?? [],
      total: (docs ?? []).length,
    });
  }
);
```

**Step 2: Create read-document endpoint**

```typescript
/**
 * GET /api/agent/tools/read-document?document_id=xxx
 *
 * Get full extracted text of a document.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { extractTextFromFile } from '@/lib/agent/file-processor';

export const GET = withApiHandler({ permission: 'read', resource: 'documents' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('document_id');

    if (!documentId) {
      return NextResponse.json({ error: 'document_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, filename, storage_path, mime_type, ai_summary, ai_tags')
      .eq('id', documentId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    let content: string;
    try {
      content = await extractTextFromFile(doc.storage_path, doc.mime_type);
    } catch {
      content = '[Could not extract text from this document]';
    }

    return NextResponse.json({
      document_id: doc.id,
      filename: doc.filename,
      summary: doc.ai_summary,
      tags: doc.ai_tags,
      content,
    });
  }
);
```

**Step 3: Create attach-document endpoint**

```typescript
/**
 * POST /api/agent/tools/attach-document
 *
 * Link a document to an event.
 * Body: { document_id: string, event_id: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

export const POST = withApiHandler({ permission: 'write', resource: 'documents' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();
    const { document_id, event_id } = body;

    if (!document_id || !event_id) {
      return NextResponse.json(
        { error: 'document_id and event_id are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify document exists and belongs to org
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', document_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Verify event exists and belongs to org
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', event_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Link the document
    const { error: updateError } = await supabase
      .from('documents')
      .update({ event_id })
      .eq('id', document_id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: `Document linked to event "${event.name}"`,
    });
  }
);
```

**Step 4: Add tools to tools.ts**

Append these three tools to the `agentTools` array in `src/lib/agent/tools.ts`:

```typescript
  // 12. get_event_documents
  {
    name: 'get_event_documents',
    description:
      'List documents attached to an event. Returns filenames, AI summaries, and tags — not the full document content. Use read_document to get full content when needed.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID',
        },
      },
      required: ['event_id'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'GET', `/api/agent/tools/event-documents?event_id=${args.event_id}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 13. read_document
  {
    name: 'read_document',
    description:
      'Get the full extracted text content of a specific document. Use get_event_documents first to find the document ID, then use this to read it in detail.',
    parameters: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Document UUID',
        },
      },
      required: ['document_id'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'GET', `/api/agent/tools/read-document?document_id=${args.document_id}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 14. attach_document
  {
    name: 'attach_document',
    description:
      'Link a document to an event. IMPORTANT: Always ask the user to confirm the event before calling this. Tell the user which event you want to link the document to and wait for their confirmation.',
    parameters: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Document UUID to attach',
        },
        event_id: {
          type: 'string',
          description: 'Event UUID to attach the document to',
        },
      },
      required: ['document_id', 'event_id'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/agent/tools/attach-document', {
        document_id: args.document_id,
        event_id: args.event_id,
      });
      return JSON.stringify(result, null, 2);
    },
  },
```

**Step 5: Commit**

```bash
git add src/app/api/agent/tools/event-documents/route.ts src/app/api/agent/tools/read-document/route.ts src/app/api/agent/tools/attach-document/route.ts src/lib/agent/tools.ts
git commit -m "feat: add document intelligence tools for agent"
```

---

### Task 15: Auto-Summarize on Upload

**Files:**
- Modify: `src/app/api/agent/chat/route.ts`

**Step 1: Trigger summarization after file upload**

After the files are uploaded and linked to the session (in the multipart handling section), add a fire-and-forget summarization call:

```typescript
// Fire-and-forget: trigger AI summarization for uploaded docs
for (const file of uploadedFiles) {
  if (!isImageType(file.mimeType)) {
    fetch(`${baseUrl}/api/documents/${file.documentId}/summarize`, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'x-organization-id': orgId,
        'x-auth-type': 'cookie',
      },
    }).catch(() => {
      // Non-critical — silently fail
    });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/agent/chat/route.ts
git commit -m "feat: auto-summarize documents uploaded in chat"
```

---

### Task 16: Build & Verify Phase C

**Step 1: Run the build**

```bash
npx next build
```

Expected: Clean build.

**Step 2: Commit any fixes**

```bash
git add -A && git commit -m "chore: lint fixes for phase C"
```

---

### Task 17: Final Build & Integration Test

**Step 1: Full build**

```bash
npx next build
```

**Step 2: Verify all new routes exist**

Check that the following routes are present in the build output:
- `/api/agent/tools/session-history`
- `/api/agent/tools/event-documents`
- `/api/agent/tools/read-document`
- `/api/agent/tools/attach-document`
- `/api/documents/[id]/summarize`

**Step 3: Final commit**

```bash
git add -A && git commit -m "feat: context window management + chat file attachments — complete"
```
