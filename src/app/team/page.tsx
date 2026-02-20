"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Users, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TeamMemberList } from "@/components/team/TeamMemberList";
import { TeamMemberForm } from "@/components/team/TeamMemberForm";
import type { TeamMember } from "@/types/database";

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      setMembers(data.team_members || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSave = async (formData: {
    name: string;
    email: string;
    phone: string;
    default_role: string;
    notes: string;
    is_active: boolean;
  }) => {
    setIsSaving(true);
    try {
      const url = editingMember ? `/api/team/${editingMember.id}` : "/api/team";
      const method = editingMember ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingMember(null);
        fetchMembers();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setShowForm(true);
  };

  const handleDelete = (member: TeamMember) => {
    setDeleteTarget(member);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const member = deleteTarget;
    setDeleteTarget(null);
    await fetch(`/api/team/${member.id}`, { method: "DELETE" });
    fetchMembers();
  };

  return (
    <AppShell data-oid="xml9grd">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove Staff Member"
        message={`Remove ${deleteTarget?.name || ""} from the staff rolls?`}
        variant="danger"
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      {/* Page Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        data-oid="jl0jc:7"
      >
        <div data-oid="3j9b-rp">
          <h1
            className="text-3xl font-serif font-bold text-wood-dark"
            data-oid="sh-l5lz"
          >
            The Partners &amp; Staff
          </h1>
          <p className="text-sepia mt-1" data-oid="btum3s5">
            {members.length} member{members.length !== 1 ? "s" : ""} on the
            rolls
          </p>
        </div>
        <div className="flex items-center gap-2" data-oid="3i0e1az">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              fetchMembers();
            }}
            data-oid="y6ni:cc"
          >
            <RefreshCw className="w-4 h-4 mr-2" data-oid=":bq7hv8" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setEditingMember(null);
              setShowForm(true);
            }}
            leftIcon={<UserPlus className="w-4 h-4" data-oid="mdile:q" />}
            data-oid="uvu5ovr"
          >
            Appoint New Staff
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse space-y-4" data-oid="kf:alp9">
          <div
            className="h-32 bg-wood-medium/10 rounded-lg"
            data-oid="b_4og91"
          />
          <div
            className="h-32 bg-wood-medium/10 rounded-lg"
            data-oid="3whm9q2"
          />
        </div>
      ) : (
        <TeamMemberList
          members={members}
          onEdit={handleEdit}
          onDelete={handleDelete}
          data-oid="vbpmqfo"
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <TeamMemberForm
          member={editingMember}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingMember(null);
          }}
          isLoading={isSaving}
          data-oid="vbwlw9t"
        />
      )}
    </AppShell>
  );
}
