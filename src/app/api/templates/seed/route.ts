/**
 * Ghostly - Seed Default Templates
 *
 * POST /api/templates/seed - Create default templates if they don't exist
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';
import type { SectionContentType } from '@/types/database';

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
    const supabase = createClient();

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
        organization_id: orgId,
        title: s.title,
        content_type: s.content_type as SectionContentType,
        ai_instructions: s.ai_instructions,
        sort_order: s.sort_order,
      }));

      await supabase.from('template_sections').insert(sectionRows);
      seeded.push(tmpl.name);
    }

    return NextResponse.json({ seeded, already_existed: [...existingNames] });
  }
);
