"use client";

import { useState, useEffect } from "react";
import { X, UserPlus, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TeamMember } from "@/types/database";

interface AssignTeamMemberModalProps {
  eventId: string;
  existingMemberIds: string[];
  onAssigned: () => void;
  onCancel: () => void;
}

export function AssignTeamMemberModal({
  eventId,
  existingMemberIds,
  onAssigned,
  onCancel,
}: AssignTeamMemberModalProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [eventRole, setEventRole] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => {
        const available = (data.team_members || []).filter(
          (m: TeamMember) => m.is_active && !existingMemberIds.includes(m.id),
        );
        setMembers(available);
      })
      .finally(() => setIsFetching(false));
  }, [existingMemberIds]);

  const handleAssign = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_member_id: selectedId,
          event_role: eventRole || null,
        }),
      });
      if (res.ok) {
        onAssigned();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMember = members.find((m) => m.id === selectedId);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      data-oid="rpgkp9k"
    >
      <div
        className="bg-background rounded-lg border border-border glass-shadow w-full max-w-md"
        data-oid="6hxnp:i"
      >
        <div
          className="px-6 py-4 border-b border-border flex items-center justify-between"
          data-oid="s4ctxz5"
        >
          <h2
            className="text-xl font-semibold text-foreground"
            data-oid="c_f.t_r"
          >
            Assign Staff to Event
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
            data-oid="600rtyb"
          >
            <X className="w-5 h-5" data-oid="xaj7l_y" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4" data-oid="reprmoi">
          {isFetching ? (
            <p className="text-sm text-muted-foreground" data-oid="php7j1p">
              Loading staff roster...
            </p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-oid="pnw:4m_">
              All active staff members are already assigned to this event.
            </p>
          ) : (
            <>
              <div data-oid="2vdbiye">
                <label
                  className="block text-sm font-medium text-foreground mb-1"
                  data-oid="s1inxbk"
                >
                  Staff Member{" "}
                  <span className="text-destructive" data-oid="vb34_p_">
                    *
                  </span>
                </label>
                <div className="space-y-2" data-oid="9ki_4ly">
                  {members.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedId === m.id
                          ? "border-spectral bg-spectral/10"
                          : "border-border hover:bg-card"
                      }`}
                      data-oid="pyeq1cl"
                    >
                      <input
                        type="radio"
                        name="member"
                        value={m.id}
                        checked={selectedId === m.id}
                        onChange={() => {
                          setSelectedId(m.id);
                          if (!eventRole && m.default_role) {
                            setEventRole(m.default_role);
                          }
                        }}
                        className="sr-only"
                        data-oid="9s.i3rv"
                      />

                      <div
                        className="w-8 h-8 rounded-full bg-spectral/10 flex items-center justify-center flex-shrink-0"
                        data-oid="l8vbcj0"
                      >
                        <User
                          className="w-4 h-4 text-muted-foreground"
                          data-oid="6oe9.3_"
                        />
                      </div>
                      <div className="flex-1" data-oid="kna0kwm">
                        <p
                          className="text-sm font-medium text-foreground"
                          data-oid="u0rqajk"
                        >
                          {m.name}
                        </p>
                        {m.default_role && (
                          <p className="text-xs text-muted-foreground" data-oid="e0bt9na">
                            {m.default_role}
                          </p>
                        )}
                      </div>
                      {selectedId === m.id && (
                        <div
                          className="w-4 h-4 rounded-full bg-spectral flex items-center justify-center"
                          data-oid="qdrugjp"
                        >
                          <div
                            className="w-2 h-2 rounded-full bg-background"
                            data-oid=".lr3ypc"
                          />
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div data-oid="ll6p-3a">
                <label
                  className="block text-sm font-medium text-foreground mb-1"
                  data-oid="sqjrvw7"
                >
                  Role for this Event
                </label>
                <input
                  type="text"
                  value={eventRole}
                  onChange={(e) => setEventRole(e.target.value)}
                  placeholder={
                    selectedMember?.default_role || "e.g., Booth Lead"
                  }
                  className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral focus:border-transparent"
                  data-oid="b0r3wr_"
                />
              </div>
            </>
          )}
        </div>

        <div
          className="px-6 py-4 border-t border-border flex justify-end gap-3"
          data-oid="bm-7q9v"
        >
          <Button variant="secondary" onClick={onCancel} data-oid="w:qumtg">
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            isLoading={isLoading}
            disabled={!selectedId || isFetching}
            leftIcon={<UserPlus className="w-4 h-4" data-oid="7wfkwua" />}
            data-oid="tcndnee"
          >
            Assign
          </Button>
        </div>
      </div>
    </div>
  );
}
