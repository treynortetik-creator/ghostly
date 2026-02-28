"use client";

import { Users } from "lucide-react";
import { TeamMemberCard } from "./TeamMemberCard";
import { EmptyState } from "@/components/ui/EmptyState";
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
      <EmptyState
        icon={<Users className="w-12 h-12" />}
        title="No Staff on the Rolls"
        description="Appoint your first team member to begin."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {members.map((member) => (
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
