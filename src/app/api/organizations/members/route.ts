/**
 * Ghostly - Organization Members API
 *
 * GET  /api/organizations/members — Lists members of the current organization
 *
 * The org ID is resolved from the x-organization-id header (set by middleware).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiHandler, getOrgId } from '@/lib/api-helpers';

// ============================================
// GET /api/organizations/members
// ============================================

export const GET = withApiHandler(
  { permission: 'read', resource: 'organization-members' },
  async (request: NextRequest) => {
    const orgId = getOrgId(request);
    const supabase = createClient();

    const { data: members, error } = await supabase
      .from('organization_members')
      .select('id, user_id, email, role, legacy_username, accepted_at, invited_at')
      .eq('organization_id', orgId)
      .order('accepted_at', { ascending: true });

    if (error) {
      console.error('Failed to list organization members:', error);
      return NextResponse.json(
        { error: 'Failed to list organization members' },
        { status: 500 }
      );
    }

    // Enrich members with display names from auth.users if possible
    const enrichedMembers = await Promise.all(
      (members || []).map(async (member) => {
        let display_name: string | null = null;

        if (member.user_id) {
          // Try to get user metadata from Supabase Auth admin API
          const { data: { user } } = await supabase.auth.admin.getUserById(member.user_id);
          if (user) {
            display_name =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email ||
              null;
            // Backfill email if the member record doesn't have one
            if (!member.email && user.email) {
              member.email = user.email;
            }
          }
        }

        return {
          ...member,
          display_name: display_name || member.legacy_username || member.email || 'Unknown',
        };
      })
    );

    return NextResponse.json({ members: enrichedMembers });
  }
);
