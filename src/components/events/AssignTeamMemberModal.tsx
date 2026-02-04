'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { TeamMember } from '@/types/database';

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
  const [selectedId, setSelectedId] = useState('');
  const [eventRole, setEventRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch('/api/team')
      .then(r => r.json())
      .then(data => {
        const available = (data.team_members || []).filter(
          (m: TeamMember) => m.is_active && !existingMemberIds.includes(m.id)
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const selectedMember = members.find(m => m.id === selectedId);

  return (
    <div className="fixed inset-0 bg-ink-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-parchment rounded-lg border border-wood-medium/40 parchment-shadow w-full max-w-md">
        <div className="px-6 py-4 border-b border-wood-medium/20 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-wood-dark">
            Assign Staff to Event
          </h2>
          <button onClick={onCancel} className="text-sepia hover:text-wood-dark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {isFetching ? (
            <p className="text-sm text-sepia">Loading staff roster...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-sepia">
              All active staff members are already assigned to this event.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">
                  Staff Member <span className="text-ink-red">*</span>
                </label>
                <div className="space-y-2">
                  {members.map(m => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedId === m.id
                          ? 'border-ink-gold bg-ink-gold/5'
                          : 'border-wood-medium/20 hover:bg-parchment-dark'
                      }`}
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
                      />
                      <div className="w-8 h-8 rounded-full bg-wood-medium/15 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-wood-medium" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-wood-dark">{m.name}</p>
                        {m.default_role && (
                          <p className="text-xs text-sepia">{m.default_role}</p>
                        )}
                      </div>
                      {selectedId === m.id && (
                        <div className="w-4 h-4 rounded-full bg-ink-gold flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-parchment" />
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-wood-dark mb-1">
                  Role for this Event
                </label>
                <input
                  type="text"
                  value={eventRole}
                  onChange={e => setEventRole(e.target.value)}
                  placeholder={selectedMember?.default_role || 'e.g., Booth Lead'}
                  className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-wood-medium/20 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={handleAssign}
            isLoading={isLoading}
            disabled={!selectedId || isFetching}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Assign
          </Button>
        </div>
      </div>
    </div>
  );
}
