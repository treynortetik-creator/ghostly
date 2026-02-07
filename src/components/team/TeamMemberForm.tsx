"use client";

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
      className="fixed inset-0 bg-ink-black/50 z-50 flex items-center justify-center p-4"
      data-oid="7i2:cui"
    >
      <div
        className="bg-parchment rounded-lg border border-wood-medium/40 parchment-shadow w-full max-w-lg"
        data-oid="f6cipc5"
      >
        <div
          className="px-6 py-4 border-b border-wood-medium/20 flex items-center justify-between"
          data-oid="xuzc.mq"
        >
          <h2
            className="font-serif text-xl font-semibold text-wood-dark"
            data-oid="ne7o2e-"
          >
            {member ? "Edit Staff Member" : "Appoint New Staff"}
          </h2>
          <button
            onClick={onCancel}
            className="text-sepia hover:text-wood-dark"
            data-oid="sy2o1a1"
          >
            <X className="w-5 h-5" data-oid="aoai:bj" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 space-y-4"
          data-oid="gqv77b_"
        >
          <div data-oid="a2qylp9">
            <label
              className="block text-sm font-medium text-wood-dark mb-1"
              data-oid=".q9uydj"
            >
              Name{" "}
              <span className="text-ink-red" data-oid="oknmhsb">
                *
              </span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
              placeholder="Full name"
              data-oid=":95cnki"
            />
          </div>

          <div data-oid="bces_xh">
            <label
              className="block text-sm font-medium text-wood-dark mb-1"
              data-oid="nljb6m6"
            >
              Role
            </label>
            <input
              type="text"
              value={defaultRole}
              onChange={(e) => setDefaultRole(e.target.value)}
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
              placeholder="e.g., Event Marketing Manager"
              data-oid="ae31ckj"
            />
          </div>

          <div className="grid grid-cols-2 gap-4" data-oid="90x03ur">
            <div data-oid="akv9mx3">
              <label
                className="block text-sm font-medium text-wood-dark mb-1"
                data-oid="6p5czzv"
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
                placeholder="email@safelyou.com"
                data-oid="5i_vyzp"
              />
            </div>
            <div data-oid="23m4x9q">
              <label
                className="block text-sm font-medium text-wood-dark mb-1"
                data-oid="3.90gx6"
              >
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
                placeholder="(555) 123-4567"
                data-oid="p3.a0k_"
              />
            </div>
          </div>

          <div data-oid="rvri6qp">
            <label
              className="block text-sm font-medium text-wood-dark mb-1"
              data-oid="cdeq1n1"
            >
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent resize-none"
              placeholder="Additional notes..."
              data-oid="1.qg.7f"
            />
          </div>

          {member && (
            <div className="flex items-center gap-2" data-oid="kj6w_u3">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-wood-medium/30"
                data-oid="ivnf7-p"
              />

              <label
                htmlFor="is_active"
                className="text-sm text-wood-dark"
                data-oid="oq67kxp"
              >
                Active member
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2" data-oid="r0_17s8">
            <Button
              variant="secondary"
              onClick={onCancel}
              type="button"
              data-oid="pmdh_qk"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading} data-oid="vp7_ghl">
              {member ? "Update" : "Appoint"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
