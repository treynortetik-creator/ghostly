'use client';

import { User, Mail, Phone, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { TeamMember } from '@/types/database';

interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
}

export function TeamMemberCard({ member, onEdit, onDelete }: TeamMemberCardProps) {
  return (
    <Card elevated className="relative">
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-wood-medium/20 flex items-center justify-center">
              <User className="w-6 h-6 text-wood-medium" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-semibold text-wood-dark">
                {member.name}
              </h3>
              {member.default_role && (
                <p className="text-sm text-sepia italic">{member.default_role}</p>
              )}
              <div className="flex flex-col gap-1 mt-2">
                {member.email && (
                  <div className="flex items-center gap-2 text-sm text-sepia/80">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2 text-sm text-sepia/80">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{member.phone}</span>
                  </div>
                )}
              </div>
              {member.notes && (
                <p className="text-xs text-sepia/60 mt-2">{member.notes}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(member)}
              aria-label="Edit member"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(member)}
              aria-label="Delete member"
            >
              <Trash2 className="w-4 h-4 text-ink-red" />
            </Button>
          </div>
        </div>
        {!member.is_active && (
          <span className="absolute top-3 right-14 text-xs bg-sepia/20 text-sepia px-2 py-0.5 rounded">
            Inactive
          </span>
        )}
      </CardContent>
    </Card>
  );
}
