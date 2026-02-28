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
      <div className="py-8 text-center text-muted-foreground">
        Loading team...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={removeConfirmId !== null}
        title="Remove Team Member"
        message="Remove this team member from the event?"
        variant="danger"
        confirmLabel="Remove"
        onConfirm={() => { if (removeConfirmId) handleRemove(removeConfirmId); }}
        onCancel={() => setRemoveConfirmId(null)}
      />
      <div className="flex items-center justify-between">
        <h3
          className="text-lg font-semibold text-foreground"
         
        >
          Assigned Staff ({assignments.length})
        </h3>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<UserPlus className="w-4 h-4" />}
          onClick={() => setShowAssignModal(true)}
         
        >
          Assign Member
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="">
            No staff assigned to this affair
          </p>
          <p className="text-sm mt-1">
            Assign team members to track who&apos;s attending.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardContent
                className="py-3 flex items-center justify-between"
               
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full bg-spectral/10 flex items-center justify-center"
                   
                  >
                    <User
                      className="w-4 h-4 text-muted-foreground"
                     
                    />
                  </div>
                  <div>
                    <p
                      className="text-sm font-medium text-foreground"
                     
                    >
                      {a.team_member?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.event_role ||
                        a.team_member?.default_role ||
                        "No role assigned"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRemoveConfirmId(a.id)}
                  className="text-muted-foreground/60 hover:text-destructive transition-colors"
                 
                >
                  <Trash2 className="w-4 h-4" />
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
         
        />
      )}
    </div>
  );
}
