# Document Generation Feature — Design Document

**Date:** 2026-02-28
**Status:** Approved

## Overview

A template-based document generation system that lets users create reusable document templates with structured sections, which the AI agent fills with event-specific data to produce markdown documents. Two default templates ship out of the box: **Run of Show** and **Event Guide**.

## Core Concepts

- **Templates** define the structure — named sections with content types and AI instructions
- **Generated Documents** are the output — markdown files filled by the AI using event data
- **Agent-driven generation** — user asks the agent in chat to generate a document for a specific event
- **Markdown output** — clean, portable, renders in-app, stored as `.md` files using existing document infrastructure

## Data Model

### `document_templates` table

```sql
CREATE TABLE document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### `template_sections` table

```sql
CREATE TYPE section_content_type AS ENUM ('text', 'table', 'list', 'custom');

CREATE TABLE template_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type section_content_type NOT NULL DEFAULT 'text',
  ai_instructions TEXT,
  default_content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Changes to existing `documents` table

```sql
-- Add 'generated' to the document_source enum
ALTER TYPE document_source ADD VALUE 'generated';

-- Add nullable template_id FK
ALTER TABLE documents ADD COLUMN template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL;
```

## Default Templates

### Run of Show

Operational playbook for the team managing the event.

| # | Section Title | Content Type | AI Instructions |
|---|--------------|-------------|-----------------|
| 1 | Event Overview | text | Event name, dates, location, goals (expansion + net new targets), approach notes |
| 2 | Schedule & Timeline | table | Day-by-day breakdown of setup, sessions, demos, networking, teardown |
| 3 | Team Assignments | table | Each assigned team member with their event role, phone, email |
| 4 | Booth Operations | text | Setup/teardown logistics, demo flow, materials needed, shipping handler info |
| 5 | Key Contacts | table | Relevant contacts (organizers, vendors) with role, phone, email |
| 6 | Action Items | list | Pre-event tasks from the checklist, grouped by owner and deadline |

### Event Guide

Everything an attendee needs to know about the event.

| # | Section Title | Content Type | AI Instructions |
|---|--------------|-------------|-----------------|
| 1 | Event Information | text | Name, dates, venue, location details, event tier, what to expect |
| 2 | Attendee Details | table | Each team member's name, role, hotel, registration status |
| 3 | Agenda | table | Full schedule with times, sessions, meetings, and notes |
| 4 | Logistics | text | Travel, hotel, parking, venue access, dress code |
| 5 | Important Contacts | table | Vendors, organizers, partners relevant to this event |
| 6 | Notes & Instructions | text | Talking points, goals, sales notes, marketing notes |

**Note:** Budget data is intentionally excluded from both templates — it's confidential internal data. Users can add a custom budget section if they choose to.

## Agent Tool — `generate_document`

Added to the agent's tool list in the chat route.

**Inputs:**
- `template_name` (string) — name of the template to use (e.g., "Run of Show")
- `event_id` (UUID) — the event to generate for

**Process:**
1. Look up template by name (org-scoped), load all sections ordered by `sort_order`
2. Pull full event context: event details, team assignments, contacts (via event_contacts), expenses, checklist items, existing documents
3. Build a single prompt containing all sections with their titles, content types, AI instructions, and the full event data payload
4. AI generates the complete markdown document in one call — one `## Section Title` per section
5. Save as `.md` file to local storage (same `uploads/YYYY/MM/{uuid}.md` pattern)
6. Insert into `documents` table with `source='generated'`, `template_id`, `event_id`
7. Return document ID and summary to the chat

**Single-call generation** — all sections filled in one API call for cost efficiency and coherence across sections.

## API Routes

All routes follow existing patterns: `withApiHandler`, `withIdempotency` (POST), audit logging, org-scoping, soft deletes.

### Templates

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/templates` | List all templates for the org (includes section count) |
| POST | `/api/templates` | Create template with sections (nested payload) |
| GET | `/api/templates/[id]` | Get template with all sections ordered by sort_order |
| PUT | `/api/templates/[id]` | Update template and upsert sections |
| DELETE | `/api/templates/[id]` | Soft delete (blocked for default templates) |

### Document Generation

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/documents/generate` | Generate document from template + event, save to disk and DB |

### Existing Routes (unchanged)

Generated documents land in the `documents` table, so these all work automatically:
- `GET /api/documents` — list (filterable by event_id, source)
- `GET /api/documents/[id]/download` — download the .md file
- Agent tools: `read_document`, `attach_document`

## UI — Documents Page

Single page at `/documents` with two tabs.

### Templates Tab

- Card grid of templates: name, description, section count, content type icons
- "Create Template" button opens the template builder
- Each card: Edit, Duplicate, Delete actions (defaults cannot be deleted)

### Generated Tab

- List/table view: document name, template used, linked event, generation date
- Each row: View (renders markdown in modal), Download (.md), Delete
- Event filter dropdown to scope to a specific event

### Template Builder (Modal)

- Name and description fields
- Section list with drag-and-drop reordering via `@dnd-kit/core` + `@dnd-kit/sortable`
- "Add Section" button
- Each section (expandable/collapsible):
  - Title input
  - Content type dropdown (text / table / list / custom)
  - AI instructions textarea ("Tell the AI what to put here")
  - Default content textarea (optional, mainly for custom type)
  - Drag handle, delete button
- Save / Cancel buttons

### Dependencies

- `@dnd-kit/core` — drag-and-drop framework (~12kb gzipped)
- `@dnd-kit/sortable` — sortable preset for ordered lists

## Scope Boundaries — What We're NOT Building

- **No PDF export** — markdown only for v1
- **No real-time collaborative editing** — single user edits templates
- **No versioning** — each generation creates a new document
- **No Slack/email distribution** — future feature
- **No budget data in default templates** — confidential, opt-in only via custom sections
