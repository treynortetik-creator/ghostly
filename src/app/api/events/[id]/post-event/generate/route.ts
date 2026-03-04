/**
 * Generate Post-Event Debrief API
 *
 * POST /api/events/:id/post-event/generate
 *
 * Converts transcript/survey text into structured post-event debrief sections
 * and upserts them into event_notes (note_type = 'post_event').
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import { OPENROUTER_API_URL, DEFAULT_AGENT_MODEL } from '@/lib/ai';
const MAX_SOURCE_CHARS = 20000;
const MAX_SECTION_CHARS = 6000;

type RouteContext = { params: Promise<{ id: string }> };

const debriefSections = [
  { key: 'went_well', title: 'What Went Well' },
  { key: 'could_improve', title: 'What Could Improve' },
  { key: 'contacts_made', title: 'Key Contacts Made' },
  { key: 'follow_up', title: 'Follow-up Actions' },
] as const;

type DebriefSectionKey = typeof debriefSections[number]['key'];

interface DebriefPayload {
  went_well?: string;
  could_improve?: string;
  contacts_made?: string;
  follow_up?: string;
}

function extractJsonPayload(raw: string): DebriefPayload | null {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as DebriefPayload;
    return parsed;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as DebriefPayload;
      return parsed;
    } catch {
      return null;
    }
  }
}

function sanitizeSection(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_SECTION_CHARS);
}

export const POST = withApiHandler({ permission: 'write', resource: 'events/post-event' },
  async (request: NextRequest, context: RouteContext) => {
    const orgId = getOrgId(request);
    const { id: eventId } = await context.params;
    const body = await request.json();
    const supabase = await createClient();

    const sourceText = typeof body.source_text === 'string' ? body.source_text.trim() : '';
    const sourceLabel = typeof body.source_label === 'string' ? body.source_label.trim() : '';
    const mode = body.mode === 'append' ? 'append' : 'replace';

    if (!sourceText) {
      return NextResponse.json({ error: 'source_text is required' }, { status: 400 });
    }

    const { data: event } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key is not configured' }, { status: 500 });
    }

    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const promptInput = sourceText.slice(0, MAX_SOURCE_CHARS);
    const label = sourceLabel || 'meeting transcript or survey';

    const orResponse = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || baseUrl,
        'X-Title': 'Ghostly Agent',
      },
      body: JSON.stringify({
        model: DEFAULT_AGENT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You create concise structured event debriefs. Return ONLY valid JSON with keys: went_well, could_improve, contacts_made, follow_up. Each value must be a plain string (2-6 bullet-like lines). If data is missing, write a short best-effort summary and note assumptions.',
          },
          {
            role: 'user',
            content: `Event: ${event.name}\nSource: ${label}\n\nSource content:\n${promptInput}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!orResponse.ok) {
      const errorText = await orResponse.text();
      console.error('Post-event debrief generation error:', orResponse.status, errorText);
      return NextResponse.json({ error: 'AI debrief generation request failed' }, { status: 502 });
    }

    const orData = await orResponse.json();
    const rawContent = orData.choices?.[0]?.message?.content || '';
    const parsed = extractJsonPayload(rawContent);

    if (!parsed) {
      return NextResponse.json({ error: 'AI response could not be parsed into debrief sections' }, { status: 502 });
    }

    const normalized: Record<DebriefSectionKey, string> = {
      went_well: sanitizeSection(parsed.went_well),
      could_improve: sanitizeSection(parsed.could_improve),
      contacts_made: sanitizeSection(parsed.contacts_made),
      follow_up: sanitizeSection(parsed.follow_up),
    };

    const { data: existingNotes, error: notesError } = await supabase
      .from('event_notes')
      .select('id, title, content')
      .eq('event_id', eventId)
      .eq('note_type', 'post_event')
      .is('deleted_at', null);

    if (notesError) throw notesError;

    const existingByTitle = new Map(
      (existingNotes || []).map((note) => [note.title, note] as const)
    );

    let savedSections = 0;

    for (const section of debriefSections) {
      const generatedContent = normalized[section.key];
      if (!generatedContent) continue;

      const existing = existingByTitle.get(section.title);
      const finalContent = mode === 'append' && existing?.content
        ? `${existing.content.trim()}\n\n${generatedContent}`
        : generatedContent;

      const metadata = {
        generated_by: 'agent',
        source_label: sourceLabel || null,
        generated_at: new Date().toISOString(),
        model: DEFAULT_AGENT_MODEL,
      };

      if (existing) {
        const { error: updateError } = await supabase
          .from('event_notes')
          .update({
            content: finalContent,
            author: 'Ghostly Agent',
            metadata,
          })
          .eq('id', existing.id)
          .eq('event_id', eventId)
          .is('deleted_at', null);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('event_notes')
          .insert({
            event_id: eventId,
            author: 'Ghostly Agent',
            note_type: 'post_event',
            title: section.title,
            content: finalContent,
            metadata,
            pinned: false,
          });

        if (insertError) throw insertError;
      }

      savedSections += 1;
    }

    return NextResponse.json({
      event_id: eventId,
      mode,
      source_label: sourceLabel || null,
      debrief: normalized,
      saved_sections: savedSections,
    });
  }
);
