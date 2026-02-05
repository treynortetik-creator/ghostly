/**
 * The Firm - Team Members API
 *
 * GET /api/team - List all active team members
 * POST /api/team - Create a new team member
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/error-logger';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ team_members: data || [] });
  } catch (err) {
    console.error('Team API error:', err);
    logError('Failed to fetch team members', { error: err as Error, source: 'api/team', context: { method: 'GET' } });
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || String(body.name).trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (String(body.name).length > 200) {
      return NextResponse.json({ error: 'Name must be 200 characters or fewer' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('team_members')
      .insert({
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        default_role: body.default_role?.trim() || null,
        is_active: body.is_active !== false,
        notes: body.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Create team member error:', err);
    logError('Failed to create team member', { error: err as Error, source: 'api/team', context: { method: 'POST' } });
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 });
  }
}
