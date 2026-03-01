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

    // Load event
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

    // Load related data in parallel (no expense data — confidential)
    const [teamResult, checklistResult, contactsResult] = await Promise.all([
      supabase
        .from('event_team_assignments')
        .select('*, team_members(*)')
        .eq('event_id', event_id),
      supabase
        .from('event_checklist_items')
        .select('*')
        .eq('event_id', event_id)
        .order('due_date', { ascending: true }),
      supabase
        .from('event_contacts')
        .select('*, contacts(*)')
        .eq('event_id', event_id),
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
      is_complete: !!item.completed_at,
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

    // Build the AI prompt (budget/expense data excluded — confidential)
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let orResponse: Response;
    try {
      orResponse = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
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
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        return NextResponse.json({ error: 'Document generation timed out' }, { status: 504 });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

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
