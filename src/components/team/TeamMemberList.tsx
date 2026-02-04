'use client';

import { TeamMemberCard } from './TeamMemberCard';
import type { TeamMember } from '@/types/database';

interface TeamMemberListProps {
  members: TeamMember[];
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
}

export function TeamMemberList({ members, onEdit, onDelete }: TeamMemberListProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-sepia">
        <p className="font-serif text-lg">No staff on the rolls</p>
        <p className="text-sm mt-1">Appoint your first team member to begin.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {members.map(member => (
        <TeamMemberCard
          key={member.id}
          member={member}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
