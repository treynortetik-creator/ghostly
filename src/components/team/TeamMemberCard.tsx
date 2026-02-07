"use client";

import { User, Mail, Phone, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { TeamMember } from "@/types/database";

interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
}

export function TeamMemberCard({
  member,
  onEdit,
  onDelete,
}: TeamMemberCardProps) {
  return (
    <Card elevated className="relative" data-oid="lj.02l-">
      <CardContent className="py-5" data-oid="kcxi1bf">
        <div className="flex items-start justify-between" data-oid="xcm:a.k">
          <div className="flex items-start gap-4" data-oid="dzchz8w">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-full bg-wood-medium/20 flex items-center justify-center"
              data-oid="o_t-kps"
            >
              <User className="w-6 h-6 text-wood-medium" data-oid="3zml-u6" />
            </div>
            <div className="space-y-1" data-oid="v0la4wo">
              <h3
                className="font-serif text-lg font-semibold text-wood-dark"
                data-oid="8s-qukp"
              >
                {member.name}
              </h3>
              {member.default_role && (
                <p className="text-sm text-sepia italic" data-oid="rlm0tl3">
                  {member.default_role}
                </p>
              )}
              <div className="flex flex-col gap-1 mt-2" data-oid="2jv1lyp">
                {member.email && (
                  <div
                    className="flex items-center gap-2 text-sm text-sepia/80"
                    data-oid="1gm52qv"
                  >
                    <Mail className="w-3.5 h-3.5" data-oid="a7nelak" />
                    <span data-oid="vvnvoj.">{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div
                    className="flex items-center gap-2 text-sm text-sepia/80"
                    data-oid="8.oo4va"
                  >
                    <Phone className="w-3.5 h-3.5" data-oid="m.igvt:" />
                    <span data-oid="zp05ae1">{member.phone}</span>
                  </div>
                )}
              </div>
              {member.notes && (
                <p className="text-xs text-sepia/60 mt-2" data-oid=".ctu_7i">
                  {member.notes}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1" data-oid="038d543">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(member)}
              aria-label="Edit member"
              data-oid="omb7c-e"
            >
              <Pencil className="w-4 h-4" data-oid="b4fck1f" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(member)}
              aria-label="Delete member"
              data-oid="smli8yz"
            >
              <Trash2 className="w-4 h-4 text-ink-red" data-oid="8p5wx9h" />
            </Button>
          </div>
        </div>
        {!member.is_active && (
          <span
            className="absolute top-3 right-14 text-xs bg-sepia/20 text-sepia px-2 py-0.5 rounded"
            data-oid="gqmz8vz"
          >
            Inactive
          </span>
        )}
      </CardContent>
    </Card>
  );
}
