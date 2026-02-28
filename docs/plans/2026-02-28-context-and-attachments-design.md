# Context Window Management & Chat File Attachments

**Date:** 2026-02-28
**Status:** Approved

---

## Overview

Two features to make the AI agent chat robust and useful for document-heavy workflows:

1. **Context window management** — track token usage, display it to the user, auto-compact conversations at 80% capacity so the agent never silently loses context.
2. **Chat file attachments** — upload files via paperclip or drag-and-drop, process them for the AI, auto-summarize/tag for future reference, and let the agent manage document-to-event linking.

---

## Phase A: Context Window Management

### Token Tracking

- Claude Sonnet 4 via OpenRouter: 200K context window, 4000 max output tokens → ~196K input capacity.
- OpenRouter returns `usage.prompt_tokens` in every response.
- After each API call, capture token count and store on `chat_sessions.context_tokens_used`.
- Stream a `context` SSE event to the client: `{ used, limit, percent }`.

### Context Bar UI

- Thin 2px progress bar below the ChatPanel header.
- Hidden below 50%.
- Colors: green (50–65%), yellow (65–80%), red (80%+).
- Tooltip on hover: "Context: 68% — auto-compacts at 80%."

### Auto-Compaction at 80%

When `percent >= 80`, before the next API call:

1. Send full conversation to Claude with compaction prompt: "Summarize this conversation's key facts, decisions, pending items, and any file/document references in under 500 words."
2. Save summary to `chat_sessions.context_summary`.
3. Prune older messages from context window (keep summary + last ~10 messages).
4. Stream `compacted` SSE event → UI renders a subtle divider: "Context refreshed — conversation summary retained."
5. Old messages remain in database for scrollback and agent reference.

### Session History Tool

New agent tool: `get_session_history`

- Parameters: `session_id` (optional), `search` (keyword, optional), `limit` (default 20)
- Returns matching messages with timestamps and session titles.
- Lets the agent search past conversations when it needs details beyond the compaction summary.

---

## Phase B: Chat File Attachments

### Supported File Types

| Type | Extensions | MIME Types | Processing |
|------|-----------|------------|------------|
| Images | PNG, JPG, GIF, WebP | image/png, image/jpeg, image/gif, image/webp | Base64 vision input to Claude |
| PDFs | .pdf | application/pdf | Server-side text extraction |
| Spreadsheets | .csv, .xlsx | text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | Parsed to text table |
| Text | .txt, .md, .json | text/plain, text/markdown, application/json | Included as-is |
| Word | .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | Text extraction |
| Email | .eml | message/rfc822 | Parsed email (from, to, subject, body) |

- Max file size: 10MB per file.
- Max files per message: 5.
- Magic byte validation for all types.

### Chat UI Changes

- **Paperclip icon** left of the textarea. Click opens file picker.
- **Drag-and-drop zone** on entire chat panel. Dragging files over shows translucent overlay: "Drop files here."
- Selected files appear as thumbnail chips above the textarea before sending.
- User can send files with or without a text message.

### Processing Pipeline

1. Files uploaded to existing document storage system (`/api/documents`), expanded for new MIME types.
2. Chat message record gets `attachments` JSONB field: `[{ document_id, filename, mime_type }]`.
3. For the AI call, content prepared by type:
   - Images → base64 vision content blocks
   - PDFs/DOCX → extracted text
   - CSV/XLSX → text table
   - EML → parsed email content (from, to, subject, date, body)
   - TXT/MD/JSON → raw content
4. AI sees file content inline and responds.

### Chat API Update

`POST /api/agent/chat` updated to accept multipart form data:
- `message` (text field)
- `files` (file fields, up to 5)
- `session_id` (text field, optional)
- `event_id` (text field, optional)

---

## Phase C: Document Intelligence

### AI Summary & Tags

On upload (chat or regular UI), a background step generates metadata:

1. Extract text from file.
2. Send to Claude: "Generate a 2–3 sentence summary and 3–5 keyword tags for this document."
3. Store on `documents` table:
   - `ai_summary` (TEXT) — short description
   - `ai_tags` (TEXT[]) — keywords like `["invoice", "catering", "Q2"]`

### Agent Document Tools

| Tool | Parameters | Returns |
|------|-----------|---------|
| `get_event_documents` | `event_id` | List of documents with filenames, summaries, tags (not full content) |
| `read_document` | `document_id` | Full extracted text of the document |
| `attach_document` | `document_id`, `event_id` | Links document to event |

### Agent-Driven Linking Flow

1. User drops file in chat.
2. Agent reads it, generates summary/tags, responds to user's message.
3. Agent checks event names, dates, vendors to determine which event the doc belongs to.
4. Agent asks: "This looks like a catering invoice for the Q2 Summit. Should I attach it to that event?"
5. User confirms → agent calls `attach_document`.
6. No match or user declines → document stays unlinked (miscellaneous bucket).

---

## Database Changes

### `chat_sessions` — new columns

```sql
context_tokens_used INTEGER NOT NULL DEFAULT 0,
context_summary TEXT
```

### `chat_messages` — new column

```sql
attachments JSONB NOT NULL DEFAULT '[]'
```

### `documents` — new columns

```sql
ai_summary TEXT,
ai_tags TEXT[] NOT NULL DEFAULT '{}',
chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL
```

### `documents` — constraint changes

- Relax XOR constraint: document can be unlinked (event_id and expense_id both null), linked to event, linked to expense, or linked to both.
- "Miscellaneous bucket" = documents where both are null.

### Expanded MIME types

Update allowed types in upload API validation and magic byte checks.

---

## New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents/[id]/summarize` | POST | Trigger AI summary generation |

### Updated Endpoints

| Endpoint | Change |
|----------|--------|
| `POST /api/agent/chat` | Accept multipart form, stream `context` and `compacted` events |
| `POST /api/documents` | Accept expanded MIME types |

---

## Implementation Order

### Phase A — Context Window Management (independent)
1. DB migration: `context_tokens_used`, `context_summary` on `chat_sessions`
2. Chat API: capture `usage.prompt_tokens`, store, stream `context` SSE event
3. ChatPanel UI: context bar (hidden <50%, green/yellow/red, tooltip)
4. Compaction logic: detect 80%, generate summary, prune context, stream `compacted`
5. ChatPanel UI: compaction divider
6. `get_session_history` agent tool

### Phase B — File Upload in Chat
1. DB migration: `attachments` on `chat_messages`, `ai_summary`/`ai_tags`/`chat_session_id` on `documents`, relax XOR
2. Expand MIME types + magic byte validation
3. Chat API: accept multipart form data
4. File processing pipeline (text extraction per type)
5. ChatPanel UI: paperclip button, drag-and-drop, file preview chips

### Phase C — Document Intelligence
1. `/api/documents/[id]/summarize` endpoint
2. Auto-summarize on upload
3. Agent tools: `get_event_documents`, `read_document`, `attach_document`
4. Agent-driven linking flow (suggest event → confirm → link)
