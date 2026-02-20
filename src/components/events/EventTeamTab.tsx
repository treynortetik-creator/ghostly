"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/Card";
import { AssignTeamMemberModal } from "./AssignTeamMemberModal";
import type { TeamMember } from "@/types/database";

interface Assignment {
  id: string;
  event_id: string;
  team_member_id: string;
  event_role: string | null;
  notes: string | null;
  team_member: TeamMember | null;
}

interface EventTeamTabProps {
  eventId: string;
}

export function EventTeamTab({ eventId }: EventTeamTabProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/team`);
      const data = await res.json();
      setAssignments(data.assignments || []);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleRemove = async (assignmentId: string) => {
    setRemoveConfirmId(null);
    await fetch(`/api/events/${eventId}/team/${assignmentId}`, {
      method: "DELETE",
    });
    fetchTeam();
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sepia" data-oid="e042sln">
        Loading team...
      </div>
    );
  }

  return (
    <div className="space-y-4" data-oid="m_s7ijb">
      <ConfirmDialog
        open={removeConfirmId !== null}
        title="Remove Team Member"
        message="Remove this team member from the event?"
        variant="danger"
        confirmLabel="Remove"
        onConfirm={() => { if (removeConfirmId) handleRemove(removeConfirmId); }}
        onCancel={() => setRemoveConfirmId(null)}
      />
      <div className="flex items-center justify-between" data-oid="dr73x1a">
        <h3
          className="font-serif text-lg font-semibold text-wood-dark"
          data-oid="x8--6a6"
        >
          Assigned Staff ({assignments.length})
        </h3>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<UserPlus className="w-4 h-4" data-oid="lixgnv3" />}
          onClick={() => setShowAssignModal(true)}
          data-oid="l-f1zcy"
        >
          Assign Member
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-8 text-sepia" data-oid="bsj-yun">
          <p className="font-serif" data-oid="82rvft2">
            No staff assigned to this affair
          </p>
          <p className="text-sm mt-1" data-oid="oi_yo4k">
            Assign team members to track who&apos;s attending.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2" data-oid="d:ufylf">
          {assignments.map((a) => (
            <Card key={a.id} data-oid="s6v.kvw">
              <CardContent
                className="py-3 flex items-center justify-between"
                data-oid="kshopqr"
              >
                <div className="flex items-center gap-3" data-oid="waluk-u">
                  <div
                    className="w-9 h-9 rounded-full bg-wood-medium/15 flex items-center justify-center"
                    data-oid="::xzaut"
                  >
                    <User
                      className="w-4 h-4 text-wood-medium"
                      data-oid="30xj_-s"
                    />
                  </div>
                  <div data-oid="2vkeueq">
                    <p
                      className="text-sm font-medium text-wood-dark"
                      data-oid="xngr-79"
                    >
                      {a.team_member?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-sepia" data-oid="l4jwkz6">
                      {a.event_role ||
                        a.team_member?.default_role ||
                        "No role assigned"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRemoveConfirmId(a.id)}
                  className="text-sepia/50 hover:text-ink-red transition-colors"
                  data-oid="rx5bxtt"
                >
                  <Trash2 className="w-4 h-4" data-oid="1rqcai:" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAssignModal && (
        <AssignTeamMemberModal
          eventId={eventId}
          existingMemberIds={assignments.map((a) => a.team_member_id)}
          onAssigned={() => {
            setShowAssignModal(false);
            fetchTeam();
          }}
          onCancel={() => setShowAssignModal(false)}
          data-oid="u1sm8cj"
        />
      )}
    </div>
  );
}
