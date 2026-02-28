"use client";

import { TeamMemberCard } from "./TeamMemberCard";
import type { TeamMember } from "@/types/database";

interface TeamMemberListProps {
  members: TeamMember[];
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
}

export function TeamMemberList({
  members,
  onEdit,
  onDelete,
}: TeamMemberListProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-oid="1ptlj_b">
        <p className="text-lg" data-oid="7slbb45">
          No staff on the rolls
        </p>
        <p className="text-sm mt-1" data-oid="d5xf9gr">
          Appoint your first team member to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2" data-oid="265e6yk">
      {members.map((member) => (
        <TeamMemberCard
          key={member.id}
          member={member}
          onEdit={onEdit}
          onDelete={onDelete}
          data-oid="3oqr71p"
        />
      ))}
    </div>
  );
}
