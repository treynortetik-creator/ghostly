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
    <AppShell>
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
       
      >
        <div>
          <h1
            className="text-3xl font-bold text-foreground"
           
          >
            The Partners &amp; Staff
          </h1>
          <p className="text-muted-foreground mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""} on the
            rolls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              fetchMembers();
            }}
           
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setEditingMember(null);
              setShowForm(true);
            }}
            leftIcon={<UserPlus className="w-4 h-4" />}
           
          >
            Appoint New Staff
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div
            className="h-32 bg-spectral/10 rounded-lg"
           
          />
          <div
            className="h-32 bg-spectral/10 rounded-lg"
           
          />
        </div>
      ) : (
        <TeamMemberList
          members={members}
          onEdit={handleEdit}
          onDelete={handleDelete}
         
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
         
        />
      )}
    </AppShell>
  );
}
