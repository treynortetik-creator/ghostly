# The Counting House — Phase 4: Document Storage

> *"A receipt without a ledger entry is a ghost of commerce past — haunting, unaccounted, and destined to return at the worst possible moment."*

**Version:** 2.0.0
**Status:** Draft
**Author:** Virgil (OpenClaw) for Treynor Tetik
**Date:** February 9, 2026
**Supersedes:** `2026-02-09-phase4-document-storage-email-ingestion-PRD.md` (v1 — overscoped)
**SITREP Task:** `1769769054105-342hpv1` (P3 → Backlog)
**Related Task:** `1770671416627-dz3kc7b` — Document Storage & Event Attachments (P2)

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [User Stories](#2-user-stories)
3. [Technical Architecture](#3-technical-architecture)
4. [Database Schema Changes](#4-database-schema-changes)
5. [API Endpoints](#5-api-endpoints)
6. [File Storage Approach](#6-file-storage-approach)
7. [UI/UX Design](#7-uiux-design)
8. [Security Considerations](#8-security-considerations)
9. [Migration & Implementation Plan](#9-migration--implementation-plan)
10. [Success Metrics](#10-success-metrics)
11. [Appendix](#11-appendix)

---

## 1. Overview & Goals

### Problem Statement

Treynor manages 45+ events per year, each generating invoices, contracts, venue agreements, and receipts. These documents live scattered across Gmail, Brex, Google Drive, and local downloads. When an expense appears in The Counting House, there's no way to see the source document. When budget questions arise in meetings, there's no quick lookup.

### Vision

Add document storage to The Counting House so every event can have its contracts and agendas, and every expense can have its receipt. Simple, direct, navigable.

### Goals

| # | Goal | Measure |
|---|------|---------|
| G1 | **Attach documents to events** | Contracts, agendas, venue agreements linked to the event |
| G2 | **Attach documents to expenses** | Receipts, invoices linked to the expense line item |
| G3 | **Scrooge can upload via API** | Programmatic upload with event/expense linking |
| G4 | **Manual drag-and-drop upload** | Treynor can drop a PDF and link it in seconds |

### Non-Goals (Explicitly Out of Scope)

- ❌ **Email ingestion infrastructure** — no SendGrid, no inbound parse, no MX records. Scrooge reads the inbox externally and uploads via API.
- ❌ **OCR / AI extraction** — no need to extract vendor, amount, or text from documents.
- ❌ **Full-text search** — users find documents by navigating to the event or expense.
- ❌ **Auto-linking with confidence scoring** — documents are linked explicitly at upload time.
- ❌ **Brex/Ramp card export storage** — those are transaction records, not receipts.
- ❌ **Multi-document linking** — one document attaches to ONE event or ONE expense, not both.
- ❌ **Image file support** — PDF and DOCX only (receipts that arrive as images get converted upstream).
- ❌ **Document version control or collaborative editing**
- ❌ **Document preview rendering** (PDF.js, etc.) — deferred; download-and-view is sufficient for now.

### What Changed from v1

The original PRD spec'd a full email ingestion pipeline (SendGrid Inbound Parse), OCR/AI extraction, auto-linking with confidence scoring, full-text search, and a dedicated "Archives" page. Treynor clarified:

1. Scrooge (AI agent) handles email monitoring externally and uploads via API — no email infrastructure needed.
2. No need to extract data from documents — they're reference material, not data sources.
3. Users find documents by navigating to the event or expense — no search needed.
4. One document → one parent (event OR expense). The existing event→expense chain already covers the hierarchy.

This PRD is the stripped-down version: file storage, simple linking, upload/download API, and UI integration.

---

## 2. User Stories

### Document Upload & Linking

| # | Story | Priority |
|---|-------|----------|
| US-1 | As Treynor, I want to upload a PDF contract and attach it to an event, so I can find the source document when reviewing that event. | P1 |
| US-2 | As Treynor, I want to upload a receipt PDF and attach it to an expense, so I have proof behind the line item. | P1 |
| US-3 | As Treynor, I want to drag-and-drop a file onto an event's document section, so uploading is fast. | P1 |
| US-4 | As Treynor, I want to see all documents for an event in a Documents tab, so I can review contracts and agendas in one place. | P1 |
| US-5 | As Treynor, I want to see attached documents on an expense detail, so I can verify the receipt. | P1 |
| US-6 | As Treynor, I want to download a document, so I can open it locally or share it. | P1 |
| US-7 | As Treynor, I want to delete a document I uploaded in error. | P2 |

### Scrooge Agent Integration

| # | Story | Priority |
|---|-------|----------|
| US-8 | As Scrooge, I want to upload a document via API and attach it to an event or expense, so I can file receipts from Treynor's email inbox. | P1 |
| US-9 | As Scrooge, I want to list documents for an event or expense, so I can include them in budget reports. | P2 |

---

## 3. Technical Architecture

### Current Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes (serverless on Railway) |
| Database | Supabase PostgreSQL |
| Auth | JWT cookie + API key (single-user + Scrooge agent) |
| Hosting | Railway |

### Phase 4 Additions

```
┌──────────────────────────────────────────────────────────────────┐
│                        The Counting House                        │
│                                                                  │
│  ┌───────────┐   ┌────────────────┐   ┌──────────────────────┐  │
│  │  Next.js   │   │  API Routes    │   │  File Storage        │  │
│  │  Frontend  │──▶│  /api/documents│──▶│  (local disk or      │  │
│  │  (Upload,  │   │                │   │   Railway volume)    │  │
│  │   List,    │   │                │   │   uploads/{year}/    │  │
│  │   Download)│   │                │   │   {month}/{uuid}.ext │  │
│  └───────────┘   └───────┬────────┘   └──────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  Supabase PostgreSQL                      │    │
│  │  documents (metadata, linking)                            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────┐                                             │
│  │  Scrooge Agent   │                                             │
│  │  (API consumer)  │── POST /api/documents (multipart)          │
│  └─────────────────┘                                             │
└──────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **File Storage** | Railway persistent volume (or local `uploads/` dir) | Simplest option; no new service. Files served via API route with auth. Migrate to S3/Supabase Storage later if needed. |
| **Linking Model** | Direct FK on `documents` table (`event_id` XOR `expense_id`) | Matches existing expense pattern (event_id XOR category_id). No join table needed for 1:1 links. |
| **File Types** | PDF and DOCX only | Covers all document types Treynor deals with. Images rejected at upload. |
| **No Separate Storage Service** | Files stored on disk, served through authenticated API routes | Avoids Supabase Storage complexity; single-user app doesn't need CDN or signed URLs. |

---

## 4. Database Schema Changes

### New Migration: `017_documents.sql`

```sql
-- ============================================
-- Document Storage Schema
-- ============================================

-- Document source: who uploaded it
CREATE TYPE document_source AS ENUM (
  'upload',         -- Manual upload via UI (Treynor)
  'api'             -- Uploaded via API (Scrooge agent)
);

-- ============================================
-- Core Documents Table
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File metadata
  filename TEXT NOT NULL,                  -- Display name (sanitized)
  original_filename TEXT NOT NULL,         -- User's original filename
  mime_type TEXT NOT NULL,                 -- application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,             -- Relative path on disk: uploads/2026/02/{uuid}.pdf

  -- Source tracking
  source document_source NOT NULL DEFAULT 'upload',

  -- Linking: exactly one of these must be set (XOR), or both null (unlinked)
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,

  -- Timestamps & soft delete
  uploaded_by TEXT NOT NULL DEFAULT 'user', -- 'user' or 'scrooge'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- At most one parent: cannot be linked to BOTH an event and an expense
  CONSTRAINT document_max_one_parent CHECK (
    NOT (event_id IS NOT NULL AND expense_id IS NOT NULL)
  )
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_documents_event ON documents(event_id) WHERE event_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_documents_expense ON documents(expense_id) WHERE expense_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_documents_created ON documents(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_unlinked ON documents(id)
  WHERE event_id IS NULL AND expense_id IS NULL AND deleted_at IS NULL;

-- ============================================
-- Updated_at trigger (reuse existing pattern)
-- ============================================
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Entity Relationship

```
┌──────────────┐         ┌──────────────┐
│   events     │◄────────│  documents   │
└──────────────┘   FK    │              │
                         │  event_id    │
┌──────────────┐   FK    │  expense_id  │
│  expenses    │◄────────│              │
└──────────────┘         └──────────────┘

One document → ONE event OR ONE expense (or neither, if unlinked).
Expenses already link to events, so: event → expense → document is navigable.
```

### Design Notes

- **No `document_links` join table.** The v1 PRD had a many-to-many link table with polymorphic targets. Treynor clarified: one document → one parent. Direct FKs on the `documents` table are simpler and match the existing `expenses` pattern.
- **XOR is soft, not hard.** The constraint allows both NULLs (unlinked document). This supports upload-then-link-later workflows, though the primary flow is link-at-upload.
- **`ON DELETE SET NULL`** rather than CASCADE. If an event or expense is deleted, the document remains (orphaned) rather than being silently destroyed. Treynor can clean up manually.

---

## 5. API Endpoints

### Overview

```
POST   /api/documents                    -- Upload a document (multipart form)
GET    /api/documents                    -- List documents (filtered)
GET    /api/documents/:id                -- Get document metadata
DELETE /api/documents/:id                -- Soft-delete a document
GET    /api/documents/:id/download       -- Download the file
PUT    /api/documents/:id/link           -- Re-link a document to a different event/expense
GET    /api/events/:id/documents         -- List documents for an event
GET    /api/expenses/:id/documents       -- List documents for an expense
```

### `POST /api/documents` — Upload Document

**Auth:** JWT cookie or API key (required)
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF or DOCX file |
| `event_id` | UUID | No | Link to this event |
| `expense_id` | UUID | No | Link to this expense |

**Validation:**
- File is required
- Max file size: **10 MB**
- Allowed MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Cannot provide both `event_id` and `expense_id`
- If `event_id` provided, must reference an existing non-deleted event
- If `expense_id` provided, must reference an existing non-deleted expense

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "filename": "venue-contract-marriott.pdf",
  "original_filename": "Venue Contract - Marriott.pdf",
  "mime_type": "application/pdf",
  "file_size_bytes": 245632,
  "storage_path": "uploads/2026/02/abc123.pdf",
  "source": "upload",
  "event_id": "uuid-of-event",
  "expense_id": null,
  "uploaded_by": "user",
  "created_at": "2026-02-09T21:00:00Z"
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing file, invalid file type, file too large, both event_id and expense_id provided |
| 404 | Referenced event_id or expense_id not found |
| 401 | Not authenticated |

### `GET /api/documents` — List Documents

**Auth:** JWT cookie or API key (required)

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `event_id` | UUID | Filter by linked event |
| `expense_id` | UUID | Filter by linked expense |
| `unlinked` | boolean | Only orphan documents (no event or expense) |
| `modified_after` | ISO date | For Scrooge incremental sync |
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (default: 20, max: 100) |

**Response:** `200 OK`

```json
{
  "documents": [
    {
      "id": "uuid",
      "filename": "venue-contract-marriott.pdf",
      "original_filename": "Venue Contract - Marriott.pdf",
      "mime_type": "application/pdf",
      "file_size_bytes": 245632,
      "source": "api",
      "event_id": "uuid",
      "event_name": "NIC Spring Conference",
      "expense_id": null,
      "uploaded_by": "scrooge",
      "created_at": "2026-02-09T21:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 12,
    "total_pages": 1
  }
}
```

### `GET /api/documents/:id` — Get Document Metadata

**Response:** `200 OK` — same shape as a single item from the list endpoint.

### `DELETE /api/documents/:id` — Soft-Delete Document

**Response:** `200 OK`

```json
{
  "message": "Document deleted successfully",
  "id": "uuid"
}
```

Sets `deleted_at` timestamp. File remains on disk (cleanup via future maintenance task).

### `GET /api/documents/:id/download` — Download File

**Response:** File stream with appropriate `Content-Type` and `Content-Disposition: attachment; filename="original_filename.pdf"` headers.

Returns 404 if document is soft-deleted or file is missing from disk.

### `PUT /api/documents/:id/link` — Re-link Document

**Request:** `application/json`

```json
{
  "event_id": "uuid-or-null",
  "expense_id": "uuid-or-null"
}
```

Use this to move a document from one parent to another, or to unlink it (both null). Same XOR validation as upload.

### Convenience Endpoints

`GET /api/events/:id/documents` and `GET /api/expenses/:id/documents` are thin wrappers around `GET /api/documents?event_id=...` / `GET /api/documents?expense_id=...`. They exist so the event detail page and expense detail page have clean data-fetching patterns.

---

## 6. File Storage Approach

### Disk Layout

```
uploads/
├── 2026/
│   ├── 01/
│   │   ├── a1b2c3d4-...-e5f6.pdf
│   │   └── ...
│   ├── 02/
│   │   ├── f7g8h9i0-...-j1k2.docx
│   │   └── ...
│   └── ...
└── ...
```

**Naming Convention:**
- Files stored as `uploads/{year}/{month}/{document_uuid}.{extension}`
- Original filename preserved in `documents.original_filename` column
- UUID-based storage names prevent collisions and path traversal attacks

### Railway Deployment

On Railway, the `uploads/` directory should be on a **persistent volume** mounted at `/app/uploads` (or equivalent). Without a persistent volume, files would be lost on redeploy.

**Alternative:** If Railway volume proves problematic, switch to Supabase Storage (private bucket, signed URLs). The API layer abstracts this — frontend never accesses files directly.

### Storage Limits

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max file size | 10 MB | Covers virtually all contracts, invoices, receipts |
| File types | PDF, DOCX | The two document types Treynor actually uses |
| Total storage | ~1 GB initially | ~45 events/year × ~5 docs/event × ~200 KB avg = ~45 MB/year. Plenty of headroom. |

---

## 7. UI/UX Design

### Integration with Existing Pages

No new standalone pages. Documents appear contextually within event detail and expense detail.

#### Event Detail — Documents Tab

Add a **"Documents"** tab alongside existing tabs (Expenses, Checklist, Notes, etc.):

```
/events/[id]
├── Expenses (existing)
├── Documents (new)     ← Contracts, agendas, venue agreements
├── Checklist (existing)
├── Notes (existing)
└── Team (existing)
```

**Documents Tab Content:**

```
┌─────────────────────────────────────────────────────────┐
│ 📎 Documents (3)                              [+ Upload]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  📄 Venue Contract - Marriott.pdf                  │ │
│  │  245 KB · Uploaded by Scrooge · Feb 3, 2026        │ │
│  │  [Download]  [Delete]                              │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  📄 Sponsorship Agreement - Acme Corp.pdf          │ │
│  │  189 KB · Uploaded by user · Feb 7, 2026           │ │
│  │  [Download]  [Delete]                              │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  📝 Event Agenda - Final.docx                      │ │
│  │  52 KB · Uploaded by user · Feb 9, 2026            │ │
│  │  [Download]  [Delete]                              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │                                                   │  │
│  │   Drop files here to upload                       │  │
│  │   PDF or DOCX — max 10 MB                        │  │
│  │                                                   │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└─────────────────────────────────────────────────────────┘
```

**Upload button** opens a file picker. **Drag-and-drop zone** at the bottom of the list accepts files. Both auto-link to the current event.

#### Expense Detail — Attachments Section

Below the expense edit form, add an attachments panel:

```
┌─────────────────────────────────────────────────────────┐
│ Expense: Marriott Ballroom Rental                       │
│ Amount: $4,250.00  |  Vendor: Marriott  |  ...          │
│                                                         │
│ 📎 Attachments (1)                            [+ Upload]│
│ ┌─────────────────────────────────────────────────────┐ │
│ │  📄 Invoice-12345.pdf   (245 KB)     [Download] [×] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│  Drop files here to attach                              │
└─────────────────────────────────────────────────────────┘
```

### Upload Component

A reusable `<DocumentUpload>` component used in both event detail and expense detail:

```tsx
// Props
interface DocumentUploadProps {
  eventId?: string;     // Pre-link to event
  expenseId?: string;   // Pre-link to expense
  onUploadComplete: (doc: Document) => void;
}
```

**Behavior:**
1. Accept file via click-to-select or drag-and-drop
2. Client-side validation: file type (PDF/DOCX) and size (≤10 MB)
3. Show upload progress indicator
4. POST to `/api/documents` as multipart form with the pre-set `event_id` or `expense_id`
5. On success, call `onUploadComplete` to refresh the document list
6. On error, show toast with error message

### Victorian Theme Notes

Keep consistent with existing Counting House styling:
- Use existing card/panel patterns from expense list
- File type icons: 📄 for PDF, 📝 for DOCX
- Upload zone uses dashed border (existing pattern for empty states)
- Delete confirmation modal (existing pattern)

---

## 8. Security Considerations

### File Upload Security

| Threat | Mitigation |
|--------|------------|
| **Malicious file upload** | Server-side MIME type validation (check magic bytes, not just extension). Only PDF and DOCX. |
| **Path traversal** | UUID-based storage paths. Never use user-supplied filenames in file paths. |
| **File size DoS** | 10 MB limit enforced at API route level (reject before buffering entire file) |
| **Direct file access** | Files served only through authenticated `/api/documents/:id/download` route. `uploads/` directory not publicly accessible. |
| **Content-type sniffing** | Serve downloads with `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment` |

### Access Control

| Resource | Auth Required | Method |
|----------|--------------|--------|
| All `/api/documents/*` | JWT cookie or API key | Existing `requirePermission()` middleware |
| Upload (`POST`) | Write permission | Same as expense creation |
| Download (`GET /download`) | Read permission | Same as expense listing |
| Delete (`DELETE`) | Write permission | Same as expense deletion |

### File Type Validation

```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

// Validate both MIME type and extension
function isAllowedFile(file: File): boolean {
  const ext = path.extname(file.name).toLowerCase();
  return ALLOWED_MIME_TYPES.includes(file.type) && ALLOWED_EXTENSIONS.includes(ext);
}
```

---

## 9. Migration & Implementation Plan

### Phase 4a: Backend — Storage, Schema, API (0.5–1 day)

**Deliverables:**
- [ ] Database migration `017_documents.sql`
- [ ] `uploads/` directory setup (Railway volume or local dev)
- [ ] `POST /api/documents` — multipart upload with file validation
- [ ] `GET /api/documents` — list with filtering and pagination
- [ ] `GET /api/documents/:id` — single document metadata
- [ ] `DELETE /api/documents/:id` — soft delete
- [ ] `GET /api/documents/:id/download` — file download
- [ ] `PUT /api/documents/:id/link` — re-link document
- [ ] `GET /api/events/:id/documents` — convenience endpoint
- [ ] `GET /api/expenses/:id/documents` — convenience endpoint
- [ ] Audit logging for all document operations
- [ ] Idempotency support on upload endpoint

### Phase 4b: Frontend — UI Integration (0.5–1 day)

**Deliverables:**
- [ ] `<DocumentUpload>` reusable component (drag-and-drop + click-to-select)
- [ ] Documents tab on event detail page
- [ ] Attachments section on expense detail page
- [ ] Document list rendering (filename, size, source, date)
- [ ] Download button
- [ ] Delete button with confirmation
- [ ] Upload progress indicator
- [ ] Error handling and toast notifications

### Phase 4c: Polish & Scrooge Testing (0.5 day)

**Deliverables:**
- [ ] Test Scrooge agent upload flow end-to-end
- [ ] Verify `modified_after` filter works for Scrooge sync
- [ ] Handle edge cases: duplicate filenames, missing files on disk, concurrent uploads
- [ ] Railway volume configuration for production
- [ ] Documentation: update API docs for Scrooge

### Total Estimated Effort: 1.5–2.5 days

### Rollback Strategy

- Migration is additive-only (new table, new enum). No changes to existing tables.
- API routes are new files — removing them has no impact on existing functionality.
- UI changes are additive tabs/sections — can be feature-flagged or removed cleanly.
- Files on disk are inert — deleting the `uploads/` directory has no impact on the rest of the app.

---

## 10. Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Documents uploaded (month 1) | 20+ | Count in `documents` table |
| Events with ≥1 document | 50% of active events | Query events joined to documents |
| Upload-to-linked time | < 30 seconds | UX observation |
| Scrooge upload success rate | 99%+ | API error rate monitoring |
| "Can I find the contract for X?" | Answerable in < 10 seconds | Navigate to event → Documents tab |

---

## 11. Appendix

### A. Environment Variables (New)

```bash
# Document storage
DOCUMENT_UPLOAD_DIR=uploads           # Relative to app root (or absolute path)
DOCUMENT_MAX_SIZE_MB=10               # Max file size in MB
```

No new external services. No SendGrid. No new API keys.

### B. File Type Matrix

| Format | Upload | Download | MIME Type |
|--------|--------|----------|-----------|
| PDF | ✅ | ✅ | `application/pdf` |
| DOCX | ✅ | ✅ | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

### C. Cost Estimates

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Railway volume (1 GB) | $0.25/GB | Persistent storage for uploads |
| Railway compute | $0 (included) | Existing deployment, no new services |
| **Total incremental** | **~$0.25/month** | |

### D. Scrooge Agent Integration

Scrooge uploads documents the same way it creates expenses — via authenticated API:

```bash
# Upload a receipt and link to an expense
curl -X POST https://example.invalid/api/documents \
  -H "Authorization: Bearer {api_key}" \
  -F "file=@invoice.pdf" \
  -F "expense_id=uuid-of-expense"

# Upload a contract and link to an event
curl -X POST https://example.invalid/api/documents \
  -H "Authorization: Bearer {api_key}" \
  -F "file=@contract.pdf" \
  -F "event_id=uuid-of-event"
```

Follows existing Scrooge conventions:
- `modified_after` parameter for incremental sync
- Standard error response format
- Audit logging with `uploaded_by: 'scrooge'`

### E. Future Considerations (Phase 5+)

- **Supabase Storage migration** — if Railway volumes prove unreliable, move to Supabase Storage with signed URLs
- **Image support** — add JPEG/PNG if receipt photos become common
- **Document preview** — inline PDF rendering with PDF.js
- **OCR extraction** — extract vendor/amount for auto-matching (if the manual workflow gets tedious)
- **Thumbnail generation** — for gallery-style document browsing
- **Bulk upload** — multiple files in one operation

---

*"Every document in its place, every penny accounted for."*
— The Counting House, est. 2026
