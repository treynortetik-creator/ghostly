# Document Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a template-based document generation system where users create reusable templates with structured sections, and the AI agent fills them with event data to produce markdown documents.

**Architecture:** Two new DB tables (`document_templates`, `template_sections`), template CRUD API routes, a generation endpoint that calls OpenRouter to fill templates with event context, a `generate_document` agent tool, and a `/documents` UI page with Templates and Generated tabs. Generated docs land in the existing `documents` table as `.md` files.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), OpenRouter (Claude Sonnet 4), @dnd-kit/core + @dnd-kit/sortable, Tailwind CSS v4

**Design doc:** `docs/plans/2026-02-28-document-generation-design.md`

---

### Task 1: Database Migration

**Files:**
- Create via Supabase MCP: migration `031_document_templates`

**Step 1: Apply the migration via Supabase MCP**

```sql
-- Create section content type enum
CREATE TYPE section_content_type AS ENUM ('text', 'table', 'list', 'custom');

-- Document templates table
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

CREATE INDEX idx_document_templates_org ON document_templates(organization_id) WHERE deleted_at IS NULL;

-- Template sections table
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

CREATE INDEX idx_template_sections_template ON template_sections(template_id);

-- Add 'generated' to document_source enum
ALTER TYPE document_source ADD VALUE IF NOT EXISTS 'generated';

-- Add template_id FK to documents table
ALTER TABLE documents ADD COLUMN template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_templates
CREATE POLICY "document_templates_select" ON document_templates
  FOR SELECT USING (true);
CREATE POLICY "document_templates_insert" ON document_templates
  FOR INSERT WITH CHECK (true);
CREATE POLICY "document_templates_update" ON document_templates
  FOR UPDATE USING (true);
CREATE POLICY "document_templates_delete" ON document_templates
  FOR DELETE USING (true);

-- RLS policies for template_sections
CREATE POLICY "template_sections_select" ON template_sections
  FOR SELECT USING (true);
CREATE POLICY "template_sections_insert" ON template_sections
  FOR INSERT WITH CHECK (true);
CREATE POLICY "template_sections_update" ON template_sections
  FOR UPDATE USING (true);
CREATE POLICY "template_sections_delete" ON template_sections
  FOR DELETE USING (true);
```

**Step 2: Verify migration applied**

Check the Supabase MCP response for success. Run a quick SQL query to verify:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'document_templates' ORDER BY ordinal_position;
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

**Step 1: Add SectionContentType enum and interfaces**

After the `ContactType` definition (around line 33), add:

```typescript
export type SectionContentType = 'text' | 'table' | 'list' | 'custom';
```

After the `EventContactWithContact` interface (around line 245), add:

```typescript
/**
 * Document template - reusable structure for generating documents
 */
export interface DocumentTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type DocumentTemplateInsert = Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>;
export type DocumentTemplateUpdate = Partial<Omit<DocumentTemplate, 'id' | 'created_at'>>;

/**
 * Template section - ordered content block within a template
 */
export interface TemplateSection {
  id: string;
  template_id: string;
  title: string;
  content_type: SectionContentType;
  ai_instructions: string | null;
  default_content: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TemplateSectionInsert = Omit<TemplateSection, 'id' | 'created_at' | 'updated_at'>;
export type TemplateSectionUpdate = Partial<Omit<TemplateSection, 'id' | 'created_at'>>;

/**
 * Template with its sections included
 */
export interface DocumentTemplateWithSections extends DocumentTemplate {
  sections: TemplateSection[];
}
```

**Step 2: Update DocumentSource type**

Change line 20 from:
```typescript
export type DocumentSource = 'upload' | 'api';
```
to:
```typescript
export type DocumentSource = 'upload' | 'api' | 'generated';
```

**Step 3: Update Document interface**

Add `template_id` field to the `Document` interface (after `chat_session_id`, around line 388):
```typescript
  template_id: string | null;
```

**Step 4: Add document_templates and template_sections to the Database interface**

Inside `public.Tables` (before the closing `};` of Tables, around line 2133), add:

```typescript
      document_templates: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          is_default: boolean;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          is_default?: boolean;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      template_sections: {
        Row: {
          id: string;
          template_id: string;
          title: string;
          content_type: SectionContentType;
          ai_instructions: string | null;
          default_content: string | null;
          sort_order: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          title: string;
          content_type?: SectionContentType;
          ai_instructions?: string | null;
          default_content?: string | null;
          sort_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string;
          title?: string;
          content_type?: SectionContentType;
          ai_instructions?: string | null;
          default_content?: string | null;
          sort_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'template_sections_template_id_fkey';
            columns: ['template_id'];
            referencedRelation: 'document_templates';
            referencedColumns: ['id'];
          }
        ];
      };
```

**Step 5: Update documents table definition**

Add `template_id` to the documents Row, Insert, and Update types in the Database interface:

In `documents.Row` (after `chat_session_id`):
```typescript
          template_id: string | null;
```

In `documents.Insert` (after `chat_session_id`):
```typescript
          template_id?: string | null;
```

In `documents.Update` (after `chat_session_id`):
```typescript
          template_id?: string | null;
```

Add to `documents.Relationships` array:
```typescript
          {
            foreignKeyName: 'documents_template_id_fkey';
            columns: ['template_id'];
            referencedRelation: 'document_templates';
            referencedColumns: ['id'];
          }
```

**Step 6: Add section_content_type to Enums**

In the `Enums` section (around line 2150), add:
```typescript
      section_content_type: SectionContentType;
```

**Step 7: Update AuditEntityType**

In `src/lib/audit.ts`, add `'template'` to the `AuditEntityType` union:
```typescript
export type AuditEntityType = 'expense' | 'event' | 'category' | 'team_member' | 'contact' | 'document' | 'template' | 'api_key' | 'webhook' | 'reminder' | 'auth';
```

**Step 8: Verify build**

Run: `npm run build`
Expected: Clean build, no type errors.

**Step 9: Commit**

```bash
git add src/types/database.ts src/lib/audit.ts
git commit -m "feat: add document template types and update DocumentSource enum"
```

---

### Task 3: Templates API Routes

**Files:**
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/templates/[id]/route.ts`

**Step 1: Create `src/app/api/templates/route.ts`**

```typescript
/**
 * Ghostly - Document Templates API
 *
 * GET /api/templates - List all templates for the org
 * POST /api/templates - Create a template with sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import { withIdempotency } from '@/lib/idempotency';
import type { SectionContentType } from '@/types/database';

const VALID_CONTENT_TYPES = ['text', 'table', 'list', 'custom'];

export const GET = withApiHandler({ permission: 'read', resource: 'templates' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_templates')
      .select('*, template_sections(id)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const templates = (data || []).map((t) => ({
      ...t,
      section_count: t.template_sections?.length || 0,
      template_sections: undefined,
    }));

    return NextResponse.json({ templates });
  }
);

export const POST = withIdempotency(
  withApiHandler({ permission: 'write', resource: 'templates' },
    async (request: NextRequest) => {
      const orgId = getOrgId(request);
      const body = await request.json();

      if (!body.name || String(body.name).trim() === '') {
        return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
      }

      const sections = body.sections;
      if (!Array.isArray(sections) || sections.length === 0) {
        return NextResponse.json({ error: 'At least one section is required' }, { status: 400 });
      }

      // Validate sections
      for (const s of sections) {
        if (!s.title || String(s.title).trim() === '') {
          return NextResponse.json({ error: 'All sections must have a title' }, { status: 400 });
        }
        if (s.content_type && !VALID_CONTENT_TYPES.includes(s.content_type)) {
          return NextResponse.json({ error: `Invalid content_type: ${s.content_type}` }, { status: 400 });
        }
      }

      const supabase = await createClient();

      // Insert template
      const { data: template, error: templateError } = await supabase
        .from('document_templates')
        .insert({
          organization_id: orgId,
          name: String(body.name).trim(),
          description: body.description ? String(body.description).trim() : null,
          is_default: false,
          created_by: body.created_by || null,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Insert sections
      const sectionRows = sections.map((s: Record<string, unknown>, i: number) => ({
        template_id: template.id,
        title: String(s.title).trim(),
        content_type: (s.content_type as SectionContentType) || 'text',
        ai_instructions: s.ai_instructions ? String(s.ai_instructions).trim() : null,
        default_content: s.default_content ? String(s.default_content).trim() : null,
        sort_order: i,
      }));

      const { data: insertedSections, error: sectionsError } = await supabase
        .from('template_sections')
        .insert(sectionRows)
        .select();

      if (sectionsError) throw sectionsError;

      await auditMutation(request, {
        entity_type: 'template',
        entity_id: template.id,
        action: 'create',
        changes: null,
      });

      return NextResponse.json({
        ...template,
        sections: insertedSections || [],
      }, { status: 201 });
    }
  )
);
```

**Step 2: Create `src/app/api/templates/[id]/route.ts`**

```typescript
/**
 * Ghostly - Single Template API
 *
 * GET /api/templates/[id] - Get template with sections
 * PUT /api/templates/[id] - Update template and upsert sections
 * DELETE /api/templates/[id] - Soft delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, auditMutation, getOrgId } from '@/lib/api-helpers';
import type { SectionContentType } from '@/types/database';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_CONTENT_TYPES = ['text', 'table', 'list', 'custom'];

export const GET = withApiHandler({ permission: 'read', resource: 'templates/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('document_templates')
      .select('*, template_sections(*)')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Sort sections by sort_order
    const sections = (data.template_sections || []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    );

    return NextResponse.json({ ...data, sections, template_sections: undefined });
  }
);

export const PUT = withApiHandler({ permission: 'write', resource: 'templates/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    // Check template exists and belongs to org
    const { data: existing, error: findError } = await supabase
      .from('document_templates')
      .select('id, is_default')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Update template fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null;

    const { error: updateError } = await supabase
      .from('document_templates')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    // If sections provided, replace all sections
    if (Array.isArray(body.sections)) {
      // Validate sections
      for (const s of body.sections) {
        if (!s.title || String(s.title).trim() === '') {
          return NextResponse.json({ error: 'All sections must have a title' }, { status: 400 });
        }
        if (s.content_type && !VALID_CONTENT_TYPES.includes(s.content_type)) {
          return NextResponse.json({ error: `Invalid content_type: ${s.content_type}` }, { status: 400 });
        }
      }

      // Delete existing sections and re-insert (simpler than upsert for ordered lists)
      await supabase
        .from('template_sections')
        .delete()
        .eq('template_id', id);

      if (body.sections.length > 0) {
        const sectionRows = body.sections.map((s: Record<string, unknown>, i: number) => ({
          template_id: id,
          title: String(s.title).trim(),
          content_type: (s.content_type as SectionContentType) || 'text',
          ai_instructions: s.ai_instructions ? String(s.ai_instructions).trim() : null,
          default_content: s.default_content ? String(s.default_content).trim() : null,
          sort_order: i,
        }));

        const { error: insertError } = await supabase
          .from('template_sections')
          .insert(sectionRows);

        if (insertError) throw insertError;
      }
    }

    // Fetch updated template with sections
    const { data: updated, error: fetchError } = await supabase
      .from('document_templates')
      .select('*, template_sections(*)')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const sections = (updated.template_sections || []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    );

    await auditMutation(request, {
      entity_type: 'template',
      entity_id: id,
      action: 'update',
      changes: null,
    });

    return NextResponse.json({ ...updated, sections, template_sections: undefined });
  }
);

export const DELETE = withApiHandler({ permission: 'write', resource: 'templates/[id]' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id } = await context.params;
    const supabase = await createClient();

    // Check template exists
    const { data: existing, error: findError } = await supabase
      .from('document_templates')
      .select('id, is_default')
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existing.is_default) {
      return NextResponse.json({ error: 'Default templates cannot be deleted' }, { status: 400 });
    }

    // Soft delete
    const { error } = await supabase
      .from('document_templates')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await auditMutation(request, {
      entity_type: 'template',
      entity_id: id,
      action: 'delete',
      changes: null,
    });

    return NextResponse.json({ success: true });
  }
);
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Clean build with `/api/templates` and `/api/templates/[id]` in the output.

**Step 4: Commit**

```bash
git add src/app/api/templates/
git commit -m "feat: add document templates CRUD API routes"
```

---

### Task 4: Default Template Seeding

**Files:**
- Create: `src/app/api/templates/seed/route.ts`

This endpoint seeds the two default templates for an org if they don't already exist. Called lazily when the Documents page loads.

**Step 1: Create `src/app/api/templates/seed/route.ts`**

```typescript
/**
 * Ghostly - Seed Default Templates
 *
 * POST /api/templates/seed - Create default templates if they don't exist
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

const DEFAULT_TEMPLATES = [
  {
    name: 'Run of Show',
    description: 'Operational playbook for your team managing the event — schedule, assignments, logistics, and action items.',
    sections: [
      { title: 'Event Overview', content_type: 'text', ai_instructions: 'Summarize the event: name, dates, location, goals (expansion and net new targets), and approach/strategy notes.', sort_order: 0 },
      { title: 'Schedule & Timeline', content_type: 'table', ai_instructions: 'Create a day-by-day breakdown including setup, sessions, demos, networking blocks, and teardown. Include times if available from the agenda or event dates.', sort_order: 1 },
      { title: 'Team Assignments', content_type: 'table', ai_instructions: 'List each assigned team member with their event role, phone number, and email. Include any assignment-specific notes.', sort_order: 2 },
      { title: 'Booth Operations', content_type: 'text', ai_instructions: 'Cover setup and teardown logistics, demo flow and materials needed, shipping handler information, and any booth-specific notes from the event record.', sort_order: 3 },
      { title: 'Key Contacts', content_type: 'table', ai_instructions: 'List relevant contacts for this event — organizers, vendors, partners — with their role, phone, and email.', sort_order: 4 },
      { title: 'Action Items', content_type: 'list', ai_instructions: 'List pre-event tasks from the event checklist, grouped by assignee. Include due dates and completion status.', sort_order: 5 },
    ],
  },
  {
    name: 'Event Guide',
    description: 'Everything an attendee needs to know — event details, agenda, logistics, contacts, and talking points.',
    sections: [
      { title: 'Event Information', content_type: 'text', ai_instructions: 'Cover the event name, dates, venue and location details, event tier, and what to expect.', sort_order: 0 },
      { title: 'Attendee Details', content_type: 'table', ai_instructions: 'List each team member attending with their name, role at the event, hotel information, and registration status if available.', sort_order: 1 },
      { title: 'Agenda', content_type: 'table', ai_instructions: 'Full schedule with times, session names, meetings, demos, and any relevant notes.', sort_order: 2 },
      { title: 'Logistics', content_type: 'text', ai_instructions: 'Cover travel arrangements, hotel details, parking, venue access instructions, dress code, and any other practical information.', sort_order: 3 },
      { title: 'Important Contacts', content_type: 'table', ai_instructions: 'List vendors, organizers, and partners relevant to this event with their role, phone, and email.', sort_order: 4 },
      { title: 'Notes & Instructions', content_type: 'text', ai_instructions: 'Include talking points, goals for the event, sales notes, marketing notes, and any other instructions for attendees.', sort_order: 5 },
    ],
  },
];

export const POST = withApiHandler({ permission: 'write', resource: 'templates/seed' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = await createClient();

    // Check if defaults already exist
    const { data: existing } = await supabase
      .from('document_templates')
      .select('name')
      .eq('organization_id', orgId)
      .eq('is_default', true)
      .is('deleted_at', null);

    const existingNames = new Set((existing || []).map((t) => t.name));
    const seeded: string[] = [];

    for (const tmpl of DEFAULT_TEMPLATES) {
      if (existingNames.has(tmpl.name)) continue;

      const { data: template, error: tErr } = await supabase
        .from('document_templates')
        .insert({
          organization_id: orgId,
          name: tmpl.name,
          description: tmpl.description,
          is_default: true,
          created_by: 'system',
        })
        .select()
        .single();

      if (tErr || !template) continue;

      const sectionRows = tmpl.sections.map((s) => ({
        template_id: template.id,
        ...s,
      }));

      await supabase.from('template_sections').insert(sectionRows);
      seeded.push(tmpl.name);
    }

    return NextResponse.json({ seeded, already_existed: [...existingNames] });
  }
);
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/templates/seed/
git commit -m "feat: add default template seeding endpoint (Run of Show, Event Guide)"
```

---

### Task 5: Document Generation Endpoint

**Files:**
- Create: `src/app/api/documents/generate/route.ts`

**Step 1: Create the generation endpoint**

```typescript
/**
 * Ghostly - Document Generation API
 *
 * POST /api/documents/generate - Generate a document from a template + event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { logAudit, getActor } from '@/lib/audit';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = process.env.DOCUMENT_UPLOAD_DIR || 'uploads';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
const AGENT_MODEL = 'anthropic/claude-sonnet-4';

function getUploadBasePath(): string {
  if (path.isAbsolute(UPLOAD_DIR)) return UPLOAD_DIR;
  return path.join(process.cwd(), UPLOAD_DIR);
}

export const POST = withApiHandler({ permission: 'write', resource: 'documents/generate' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const body = await request.json();

    const { template_id, event_id } = body;
    if (!template_id || !event_id) {
      return NextResponse.json({ error: 'template_id and event_id are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Load template with sections
    const { data: template, error: tErr } = await supabase
      .from('document_templates')
      .select('*, template_sections(*)')
      .eq('id', template_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (tErr || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const sections = (template.template_sections || []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    );

    if (sections.length === 0) {
      return NextResponse.json({ error: 'Template has no sections' }, { status: 400 });
    }

    // Load event with all context
    const { data: event, error: eErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (eErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Load related data in parallel
    const [teamResult, checklistResult, contactsResult, expensesResult] = await Promise.all([
      // Team assignments
      supabase
        .from('event_team_assignments')
        .select('*, team_members(*)')
        .eq('event_id', event_id),
      // Checklist items
      supabase
        .from('event_checklist_items')
        .select('*')
        .eq('event_id', event_id)
        .order('due_date', { ascending: true }),
      // Contacts
      supabase
        .from('event_contacts')
        .select('*, contacts(*)')
        .eq('event_id', event_id),
      // Expenses (non-deleted, for reference)
      supabase
        .from('expenses')
        .select('vendor, amount, memo, expense_date')
        .eq('event_id', event_id)
        .is('deleted_at', null)
        .order('expense_date', { ascending: true }),
    ]);

    const teamAssignments = (teamResult.data || []).map((a: Record<string, unknown>) => {
      const member = a.team_members as Record<string, unknown> | null;
      return {
        name: member?.name || 'Unknown',
        email: member?.email || null,
        phone: member?.phone || null,
        default_role: member?.default_role || null,
        event_role: a.event_role || null,
        notes: a.notes || null,
      };
    });

    const checklist = (checklistResult.data || []).map((item: Record<string, unknown>) => ({
      title: item.title,
      phase: item.phase,
      is_complete: item.is_complete,
      due_date: item.due_date || null,
      assigned_to: item.assigned_to || null,
      description: item.description || null,
    }));

    const contacts = (contactsResult.data || []).map((ec: Record<string, unknown>) => {
      const c = ec.contacts as Record<string, unknown> | null;
      return {
        first_name: c?.first_name || '',
        last_name: c?.last_name || '',
        company: c?.company || null,
        email: c?.email || null,
        phone: c?.phone || null,
        contact_type: c?.contact_type || 'other',
        contact_role: ec.contact_role || null,
      };
    });

    const expenses = expensesResult.data || [];

    // Build the AI prompt
    const eventContext = JSON.stringify({
      event: {
        name: event.name,
        date_start: event.date_start,
        date_end: event.date_end,
        location: event.location,
        quarter: event.quarter,
        stage: event.stage,
        tier: event.tier,
        approach_notes: event.approach_notes,
        marketing_notes: event.marketing_notes,
        sales_notes: event.sales_notes,
        shipping_handler: event.shipping_handler,
        expansion_goal: event.expansion_goal,
        net_new_goal: event.net_new_goal,
      },
      team_assignments: teamAssignments,
      checklist_items: checklist,
      contacts,
      expenses,
    }, null, 2);

    const sectionInstructions = sections.map((s: Record<string, unknown>, i: number) => {
      const contentType = s.content_type as string;
      const formatHint =
        contentType === 'table' ? 'Format this section as a markdown table with headers.' :
        contentType === 'list' ? 'Format this section as a markdown bullet list.' :
        contentType === 'custom' && s.default_content ? `Use this structure as a starting point:\n${s.default_content}` :
        'Format this section as prose paragraphs.';

      return `## Section ${i + 1}: ${s.title}\nContent type: ${contentType}\nInstructions: ${s.ai_instructions || 'Fill in based on available event data.'}\n${formatHint}`;
    }).join('\n\n');

    const systemPrompt = `You are a document generator for Ghostly, an event operations platform. Generate a well-formatted markdown document based on the template sections and event data provided. Use only the data given — do not fabricate information. If data for a section is unavailable, note that it's not yet available rather than making something up.

Output ONLY the markdown document content. No preamble, no explanation. Start with a level-1 heading using the document title.`;

    const userPrompt = `Generate a "${template.name}" document for the event "${event.name}".

EVENT DATA:
${eventContext}

TEMPLATE SECTIONS (generate each as a ## heading in order):
${sectionInstructions}`;

    // Call OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    const orResponse = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Ghostly Document Generator',
      },
      body: JSON.stringify({
        model: AGENT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!orResponse.ok) {
      const errText = await orResponse.text();
      console.error('OpenRouter generation failed:', errText);
      return NextResponse.json({ error: 'Document generation failed' }, { status: 502 });
    }

    const orData = await orResponse.json();
    const markdownContent = orData.choices?.[0]?.message?.content || '';

    if (!markdownContent) {
      return NextResponse.json({ error: 'AI returned empty content' }, { status: 502 });
    }

    // Save as .md file
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const docId = randomUUID();
    const filename = `${template.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${event.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.md`;
    const storagePath = `uploads/${year}/${month}/${docId}.md`;

    const absolutePath = path.join(getUploadBasePath(), year, month);
    await fs.mkdir(absolutePath, { recursive: true });
    const buffer = Buffer.from(markdownContent, 'utf-8');
    await fs.writeFile(path.join(absolutePath, `${docId}.md`), buffer);

    // Insert document record
    const { actor, actor_type } = await getActor(request);

    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        organization_id: orgId,
        filename,
        original_filename: filename,
        mime_type: 'text/markdown',
        file_size_bytes: buffer.length,
        storage_path: storagePath,
        source: 'generated',
        event_id,
        template_id,
        uploaded_by: actor_type === 'agent' ? actor : 'user',
      })
      .select()
      .single();

    if (insertError) {
      // Clean up file
      try { await fs.unlink(path.join(absolutePath, `${docId}.md`)); } catch { /* ignore */ }
      throw insertError;
    }

    // Audit log
    try {
      logAudit({
        entity_type: 'document',
        entity_id: newDoc.id,
        action: 'create',
        changes: null,
        actor,
        actor_type,
        metadata: {
          template_id,
          template_name: template.name,
          event_id,
          event_name: event.name,
          source: 'generated',
        },
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      document: newDoc,
      template_name: template.name,
      event_name: event.name,
    }, { status: 201 });
  }
);
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/documents/generate/
git commit -m "feat: add document generation endpoint — AI fills templates with event data"
```

---

### Task 6: Agent Tool — `generate_document`

**Files:**
- Modify: `src/lib/agent/tools.ts`

**Step 1: Add the generate_document tool**

Add this as tool #15 at the end of the `agentTools` array (before the closing `];`):

```typescript
  // 15. generate_document
  {
    name: 'generate_document',
    description:
      'Generate a document from a template for a specific event. The AI fills each template section with event data (team, contacts, checklist, etc) and saves it as a markdown file. Use get_events to find the event_id first. Available templates: "Run of Show" (operational playbook) and "Event Guide" (attendee reference). Users may also have custom templates.',
    parameters: {
      type: 'object',
      properties: {
        template_name: {
          type: 'string',
          description: 'Name of the template to use (e.g., "Run of Show", "Event Guide")',
        },
        event_id: {
          type: 'string',
          description: 'Event UUID to generate the document for',
        },
      },
      required: ['template_name', 'event_id'],
    },
    execute: async (args, ctx) => {
      // First, look up template by name
      const templatesResult = await internalFetch(ctx, 'GET', '/api/templates');
      const templates = ((templatesResult as Record<string, unknown>).templates as Record<string, unknown>[]) ?? [];
      const template = templates.find(
        (t) => String(t.name).toLowerCase() === String(args.template_name).toLowerCase()
      );

      if (!template) {
        const available = templates.map((t) => t.name).join(', ');
        return JSON.stringify({
          error: `Template "${args.template_name}" not found. Available templates: ${available || 'none — ask the user to create one first'}`,
        });
      }

      // Generate the document
      const result = await internalFetch(ctx, 'POST', '/api/documents/generate', {
        template_id: template.id,
        event_id: args.event_id,
      });

      const data = result as Record<string, unknown>;
      const doc = data.document as Record<string, unknown>;

      return JSON.stringify({
        success: true,
        document_id: doc?.id,
        filename: doc?.filename,
        template_name: data.template_name,
        event_name: data.event_name,
        message: `Generated "${data.template_name}" for ${data.event_name}. Document saved and attached to the event.`,
      }, null, 2);
    },
  },
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/lib/agent/tools.ts
git commit -m "feat: add generate_document agent tool"
```

---

### Task 7: Install @dnd-kit Dependencies

**Step 1: Install packages**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit for drag-and-drop section reordering"
```

---

### Task 8: UI Components — Template Section Editor

**Files:**
- Create: `src/components/documents/SortableSection.tsx`

**Step 1: Create the sortable section component**

This is a single section row in the template builder with drag handle, title, content type, AI instructions, and delete button.

```typescript
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SectionContentType } from "@/types/database";

const CONTENT_TYPES: { value: SectionContentType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "table", label: "Table" },
  { value: "list", label: "List" },
  { value: "custom", label: "Custom" },
];

const TYPE_COLORS: Record<SectionContentType, string> = {
  text: "bg-blue-500/15 text-blue-400",
  table: "bg-emerald-500/15 text-emerald-400",
  list: "bg-amber-500/15 text-amber-400",
  custom: "bg-purple-500/15 text-purple-400",
};

export interface SectionData {
  id: string;
  title: string;
  content_type: SectionContentType;
  ai_instructions: string;
  default_content: string;
}

interface SortableSectionProps {
  section: SectionData;
  onChange: (id: string, field: keyof SectionData, value: string) => void;
  onDelete: (id: string) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral focus:border-transparent";

export function SortableSection({ section, onChange, onDelete }: SortableSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-border rounded-lg bg-card"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground"
          tabIndex={-1}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {section.title || "Untitled Section"}
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            TYPE_COLORS[section.content_type] || TYPE_COLORS.text
          }`}
        >
          {section.content_type}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(section.id)}
          aria-label="Delete section"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Section Title
              </label>
              <input
                type="text"
                value={section.title}
                onChange={(e) => onChange(section.id, "title", e.target.value)}
                placeholder="e.g., Attendee Details"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Content Type
              </label>
              <select
                value={section.content_type}
                onChange={(e) =>
                  onChange(section.id, "content_type", e.target.value)
                }
                className={inputClass}
              >
                {CONTENT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              AI Instructions
            </label>
            <textarea
              value={section.ai_instructions}
              onChange={(e) =>
                onChange(section.id, "ai_instructions", e.target.value)
              }
              rows={2}
              className={`${inputClass} resize-none`}
              placeholder="Tell the AI what to put in this section..."
            />
          </div>
          {section.content_type === "custom" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Default Content (markdown skeleton)
              </label>
              <textarea
                value={section.default_content}
                onChange={(e) =>
                  onChange(section.id, "default_content", e.target.value)
                }
                rows={3}
                className={`${inputClass} resize-none font-mono text-sm`}
                placeholder="## Your custom structure here..."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/documents/SortableSection.tsx
git commit -m "feat: add SortableSection component with drag-and-drop support"
```

---

### Task 9: UI Components — Template Builder Modal

**Files:**
- Create: `src/components/documents/TemplateBuilder.tsx`

**Step 1: Create the template builder**

```typescript
"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SortableSection, type SectionData } from "./SortableSection";
import type { DocumentTemplateWithSections } from "@/types/database";
import { randomId } from "@/lib/utils";

interface TemplateBuilderProps {
  template?: DocumentTemplateWithSections | null;
  onSave: (data: {
    name: string;
    description: string;
    sections: Omit<SectionData, "id">[];
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const inputClass =
  "w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral focus:border-transparent";

export function TemplateBuilder({
  template,
  onSave,
  onCancel,
  isLoading,
}: TemplateBuilderProps) {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [sections, setSections] = useState<SectionData[]>(() => {
    if (template?.sections?.length) {
      return template.sections.map((s) => ({
        id: s.id || randomId(),
        title: s.title,
        content_type: s.content_type,
        ai_instructions: s.ai_instructions || "",
        default_content: s.default_content || "",
      }));
    }
    return [
      {
        id: randomId(),
        title: "",
        content_type: "text" as const,
        ai_instructions: "",
        default_content: "",
      },
    ];
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleSectionChange = useCallback(
    (id: string, field: keyof SectionData, value: string) => {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      );
    },
    []
  );

  const handleDeleteSection = useCallback((id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAddSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: randomId(),
        title: "",
        content_type: "text" as const,
        ai_instructions: "",
        default_content: "",
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      sections: sections.map(({ title, content_type, ai_instructions, default_content }) => ({
        title,
        content_type,
        ai_instructions,
        default_content,
      })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg border border-border glass-shadow w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {template ? "Edit Template" : "Create Template"}
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Template Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
              placeholder="e.g., Run of Show"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="What is this template for?"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">
                Sections
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddSection}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Section
              </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      onChange={handleSectionChange}
                      onDelete={handleDeleteSection}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {sections.length === 0 && (
              <p className="text-sm text-muted-foreground/60 text-center py-4">
                No sections yet. Add at least one section.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={!name.trim() || sections.length === 0}
            >
              {template ? "Update" : "Create Template"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Check if `randomId` exists in utils, if not add it**

Check `src/lib/utils.ts` for a `randomId` function. If not present, add:

```typescript
export function randomId(): string {
  return Math.random().toString(36).substring(2, 11);
}
```

**Step 3: Commit**

```bash
git add src/components/documents/TemplateBuilder.tsx src/lib/utils.ts
git commit -m "feat: add TemplateBuilder modal with drag-and-drop section ordering"
```

---

### Task 10: UI Components — Template Card & Generated Document Row

**Files:**
- Create: `src/components/documents/TemplateCard.tsx`
- Create: `src/components/documents/GeneratedDocRow.tsx`
- Create: `src/components/documents/MarkdownViewer.tsx`
- Create: `src/components/documents/index.ts`

**Step 1: Create TemplateCard**

```typescript
"use client";

import { FileText, Pencil, Copy, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SectionContentType } from "@/types/database";

const TYPE_COLORS: Record<SectionContentType, string> = {
  text: "bg-blue-500/15 text-blue-400",
  table: "bg-emerald-500/15 text-emerald-400",
  list: "bg-amber-500/15 text-amber-400",
  custom: "bg-purple-500/15 text-purple-400",
};

interface TemplateCardData {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  section_count: number;
}

interface TemplateCardProps {
  template: TemplateCardData;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
}: TemplateCardProps) {
  return (
    <Card elevated className="relative">
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-spectral/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-spectral" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {template.name}
              </h3>
              {template.description && (
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {template.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground/60 mt-1">
                {template.section_count} section
                {template.section_count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(template.id)}
              aria-label="Edit template"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDuplicate(template.id)}
              aria-label="Duplicate template"
            >
              <Copy className="w-4 h-4" />
            </Button>
            {!template.is_default && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(template.id)}
                aria-label="Delete template"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {template.is_default && (
          <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded bg-spectral/15 text-spectral">
            Default
          </span>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create MarkdownViewer**

```typescript
"use client";

import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface MarkdownViewerProps {
  content: string;
  filename: string;
  documentId: string;
  onClose: () => void;
}

export function MarkdownViewer({
  content,
  filename,
  documentId,
  onClose,
}: MarkdownViewerProps) {
  const handleDownload = () => {
    window.open(`/api/documents/${documentId}/download`, "_blank");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg border border-border glass-shadow w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground truncate">
            {filename}
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="prose prose-invert max-w-none text-foreground prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-td:text-muted-foreground prose-th:text-foreground">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create GeneratedDocRow**

```typescript
"use client";

import { FileText, Eye, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface GeneratedDoc {
  id: string;
  filename: string;
  event_name: string | null;
  template_name?: string | null;
  created_at: string;
  file_size_bytes: number;
}

interface GeneratedDocRowProps {
  doc: GeneratedDoc;
  onView: (doc: GeneratedDoc) => void;
  onDelete: (doc: GeneratedDoc) => void;
}

export function GeneratedDocRow({ doc, onView, onDelete }: GeneratedDocRowProps) {
  const date = new Date(doc.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const sizeKb = Math.round(doc.file_size_bytes / 1024);

  return (
    <div className="flex items-center gap-4 px-4 py-3 border border-border rounded-lg bg-card hover:bg-card/80 transition-colors">
      <FileText className="w-5 h-5 text-spectral flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {doc.filename}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {doc.event_name && <span>{doc.event_name} &middot; </span>}
          {date} &middot; {sizeKb}KB
        </p>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onView(doc)}
          aria-label="View document"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
          aria-label="Download document"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(doc)}
          aria-label="Delete document"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Create barrel export**

```typescript
export { TemplateCard } from './TemplateCard';
export { TemplateBuilder } from './TemplateBuilder';
export { SortableSection } from './SortableSection';
export { GeneratedDocRow } from './GeneratedDocRow';
export { MarkdownViewer } from './MarkdownViewer';
```

**Step 5: Verify build**

Run: `npm run build`

**Step 6: Commit**

```bash
git add src/components/documents/
git commit -m "feat: add TemplateCard, GeneratedDocRow, and MarkdownViewer components"
```

---

### Task 11: Documents Page

**Files:**
- Create: `src/app/documents/page.tsx`

**Step 1: Create the Documents page**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  TemplateCard,
  TemplateBuilder,
  GeneratedDocRow,
  MarkdownViewer,
} from "@/components/documents";
import type { DocumentTemplateWithSections, SectionContentType } from "@/types/database";

type Tab = "templates" | "generated";

interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  section_count: number;
}

interface GeneratedDoc {
  id: string;
  filename: string;
  event_name: string | null;
  template_name?: string | null;
  created_at: string;
  file_size_bytes: number;
}

export default function DocumentsPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Template builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplateWithSections | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ type: "template" | "document"; id: string; name: string } | null>(null);

  // Viewer state
  const [viewingDoc, setViewingDoc] = useState<{ content: string; filename: string; id: string } | null>(null);

  // Seed defaults on mount
  useEffect(() => {
    fetch("/api/templates/seed", { method: "POST" }).catch(() => {});
  }, []);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.templates || []);
  }, []);

  const fetchGeneratedDocs = useCallback(async () => {
    const res = await fetch("/api/documents?source=generated");
    const data = await res.json();
    setGeneratedDocs(
      (data.documents || []).map((d: Record<string, unknown>) => ({
        id: d.id,
        filename: d.filename,
        event_name: d.event_name || null,
        created_at: d.created_at,
        file_size_bytes: d.file_size_bytes || 0,
      }))
    );
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchTemplates(), fetchGeneratedDocs()]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTemplates, fetchGeneratedDocs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleEditTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${id}`);
    const data = await res.json();
    setEditingTemplate(data);
    setShowBuilder(true);
  };

  const handleDuplicateTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/${id}`);
    const data = await res.json();
    // Create a copy with modified name
    const copyData = {
      name: `${data.name} (Copy)`,
      description: data.description,
      sections: (data.sections || []).map((s: Record<string, unknown>) => ({
        title: s.title,
        content_type: s.content_type,
        ai_instructions: s.ai_instructions,
        default_content: s.default_content,
      })),
    };
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(copyData),
    });
    fetchTemplates();
  };

  const handleSaveTemplate = async (data: {
    name: string;
    description: string;
    sections: { title: string; content_type: SectionContentType; ai_instructions: string; default_content: string }[];
  }) => {
    setIsSaving(true);
    try {
      const url = editingTemplate
        ? `/api/templates/${editingTemplate.id}`
        : "/api/templates";
      const method = editingTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowBuilder(false);
        setEditingTemplate(null);
        fetchTemplates();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewDoc = async (doc: GeneratedDoc) => {
    const res = await fetch(`/api/documents/${doc.id}/download`);
    if (res.ok) {
      const text = await res.text();
      setViewingDoc({ content: text, filename: doc.filename, id: doc.id });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    setDeleteTarget(null);

    if (type === "template") {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      fetchTemplates();
    } else {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      fetchGeneratedDocs();
    }
  };

  return (
    <AppShell>
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.type === "template" ? "Template" : "Document"}`}
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {viewingDoc && (
        <MarkdownViewer
          content={viewingDoc.content}
          filename={viewingDoc.filename}
          documentId={viewingDoc.id}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Templates and AI-generated documents for your events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              fetchAll();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {tab === "templates" && (
            <Button
              onClick={() => {
                setEditingTemplate(null);
                setShowBuilder(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Template
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {(["templates", "generated"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              tab === t
                ? "bg-spectral/15 text-spectral font-medium"
                : "text-muted-foreground hover:bg-spectral/5 hover:text-foreground"
            }`}
          >
            {t === "templates" ? "Templates" : "Generated"}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-spectral/10 rounded-lg" />
          <div className="h-32 bg-spectral/10 rounded-lg" />
        </div>
      ) : tab === "templates" ? (
        templates.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="No Templates"
            description="Create a template to start generating documents."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={handleEditTemplate}
                onDuplicate={handleDuplicateTemplate}
                onDelete={(id) =>
                  setDeleteTarget({ type: "template", id, name: t.name })
                }
              />
            ))}
          </div>
        )
      ) : generatedDocs.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="No Generated Documents"
          description='Ask the AI agent to "generate a Run of Show for [event name]" to create your first document.'
        />
      ) : (
        <div className="space-y-2">
          {generatedDocs.map((doc) => (
            <GeneratedDocRow
              key={doc.id}
              doc={doc}
              onView={handleViewDoc}
              onDelete={(d) =>
                setDeleteTarget({ type: "document", id: d.id, name: d.filename })
              }
            />
          ))}
        </div>
      )}

      {/* Template Builder Modal */}
      {showBuilder && (
        <TemplateBuilder
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => {
            setShowBuilder(false);
            setEditingTemplate(null);
          }}
          isLoading={isSaving}
        />
      )}
    </AppShell>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/documents/
git commit -m "feat: add Documents page with Templates and Generated tabs"
```

---

### Task 12: Add Documents to Sidebar Navigation

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

**Step 1: Add FileText import and nav item**

Add `FileText` to the lucide-react imports (it may already be imported — check first).

Add the Documents nav item to the `navItems` array after Contacts:

```typescript
  { name: "Documents", href: "/documents", icon: FileText },
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/layout/AppShell.tsx
git commit -m "feat: add Documents to sidebar navigation"
```

---

### Task 13: Update Documents API to Support Source Filter

**Files:**
- Modify: `src/app/api/documents/route.ts`

The Documents page fetches generated docs with `?source=generated`. The existing GET handler doesn't support this filter.

**Step 1: Add source filter**

In the GET handler, after the `unlinked` filter check (around line 146), add:

```typescript
    const source = searchParams.get('source');
    if (source) {
      query = query.eq('source', source);
    }
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/documents/route.ts
git commit -m "feat: add source filter to documents GET endpoint"
```

---

### Task 14: Final Build Verification

**Step 1: Run full build**

Run: `npm run build`
Expected: Clean build with all new routes visible:
- `/api/templates`
- `/api/templates/[id]`
- `/api/templates/seed`
- `/api/documents/generate`
- `/documents`

**Step 2: Verify all files are committed**

Run: `git status`
Expected: Clean working tree.
