"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TeamMember } from "@/types/database";

interface TeamMemberFormProps {
  member?: TeamMember | null;
  onSave: (data: {
    name: string;
    email: string;
    phone: string;
    default_role: string;
    notes: string;
    is_active: boolean;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TeamMemberForm({
  member,
  onSave,
  onCancel,
  isLoading,
}: TeamMemberFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultRole, setDefaultRole] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (member) {
      setName(member.name || "");
      setEmail(member.email || "");
      setPhone(member.phone || "");
      setDefaultRole(member.default_role || "");
      setNotes(member.notes || "");
      setIsActive(member.is_active);
    }
  }, [member]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      email,
      phone,
      default_role: defaultRole,
      notes,
      is_active: isActive,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
     
    >
      <div
        className="bg-background rounded-lg border border-border glass-shadow w-full max-w-lg"
       
      >
        <div
          className="px-6 py-4 border-b border-border flex items-center justify-between"
         
        >
          <h2
            className="text-xl font-semibold text-foreground"
           
          >
            {member ? "Edit Staff Member" : "Appoint New Staff"}
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
           
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 space-y-4"
         
        >
          <div>
            <label
              className="block text-sm font-medium text-foreground mb-1"
             
            >
              Name{" "}
              <span className="text-destructive">
                *
              </span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral focus:ring-offset-1 focus:ring-offset-background"
              placeholder="Full name"
             
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-foreground mb-1"
             
            >
              Role
            </label>
            <input
              type="text"
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral focus:ring-offset-1 focus:ring-offset-background"
              placeholder="e.g., Event Marketing Manager"
             
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="block text-sm font-medium text-foreground mb-1"
               
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral focus:ring-offset-1 focus:ring-offset-background"
                placeholder="email@safelyou.com"
               
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium text-foreground mb-1"
               
              >
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral focus:ring-offset-1 focus:ring-offset-background"
                placeholder="(555) 123-4567"
               
              />
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-foreground mb-1"
             
            >
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral focus:ring-offset-1 focus:ring-offset-background resize-none"
              placeholder="Additional notes..."
             
            />
          </div>

          {member && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border"
               
              />

              <label
                htmlFor="is_active"
                className="text-sm text-foreground"
               
              >
                Active member
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={onCancel}
              type="button"
             
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {member ? "Update" : "Appoint"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
