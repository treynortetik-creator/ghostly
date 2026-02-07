"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ChecklistPhase, TeamMember } from "@/types/database";

interface ChecklistItemFormProps {
  teamMembers: TeamMember[];
  onSave: (data: {
    title: string;
    description: string;
    phase: ChecklistPhase;
    assignee_id: string;
    due_date: string;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ChecklistItemForm({
  teamMembers,
  onSave,
  onCancel,
  isLoading,
}: ChecklistItemFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<ChecklistPhase>("pre_event");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      phase,
      assignee_id: assigneeId,
      due_date: dueDate,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-ink-black/50 z-50 flex items-center justify-center p-4"
      data-oid="f1u7cfq"
    >
      <div
        className="bg-parchment rounded-lg border border-wood-medium/40 parchment-shadow w-full max-w-lg"
        data-oid="d7:_cn8"
      >
        <div
          className="px-6 py-4 border-b border-wood-medium/20 flex items-center justify-between"
          data-oid="miaptc."
        >
          <h2
            className="font-serif text-xl font-semibold text-wood-dark"
            data-oid="p5oo13b"
          >
            Add Task
          </h2>
          <button
            onClick={onCancel}
            className="text-sepia hover:text-wood-dark"
            data-oid="88v2cq1"
          >
            <X className="w-5 h-5" data-oid=":ar.met" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 space-y-4"
          data-oid="wqqqc60"
        >
          <div data-oid="r4t-.yc">
            <label
              className="block text-sm font-medium text-wood-dark mb-1"
              data-oid="8tf6ad3"
            >
              Task{" "}
              <span className="text-ink-red" data-oid="-8xijab">
                *
              </span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
              placeholder="Task description"
              data-oid="vkq5:eh"
            />
          </div>

          <div data-oid="h_j33bf">
            <label
              className="block text-sm font-medium text-wood-dark mb-1"
              data-oid="ccbp-pi"
            >
              Details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black placeholder-sepia/40 focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent resize-none"
              placeholder="Additional details..."
              data-oid="ldxhpkl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4" data-oid="8k29c12">
            <div data-oid="1zu5l8h">
              <label
                className="block text-sm font-medium text-wood-dark mb-1"
                data-oid="ghhrqum"
              >
                Phase
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as ChecklistPhase)}
                className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
                data-oid="l0czie:"
              >
                <option value="pre_event" data-oid="26k0-0v">
                  Before the Affair
                </option>
                <option value="day_of" data-oid=":i1f1ja">
                  The Day Itself
                </option>
                <option value="post_event" data-oid="js_4f_o">
                  After the Affair
                </option>
              </select>
            </div>
            <div data-oid="tpd-hsw">
              <label
                className="block text-sm font-medium text-wood-dark mb-1"
                data-oid="nt-_850"
              >
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
                data-oid="_42z6.a"
              />
            </div>
          </div>

          <div data-oid="euuub3d">
            <label
              className="block text-sm font-medium text-wood-dark mb-1"
              data-oid="9p5d.d."
            >
              Assignee
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 bg-parchment-dark border border-wood-medium/30 rounded-md text-ink-black focus:outline-none focus:ring-2 focus:ring-ink-gold focus:border-transparent"
              data-oid="f84eqxc"
            >
              <option value="" data-oid="29673je">
                Unassigned
              </option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id} data-oid="uupx9h0">
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2" data-oid="8:9m0pu">
            <Button
              variant="secondary"
              onClick={onCancel}
              type="button"
              data-oid="1a4:xz7"
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading} data-oid="9599vfz">
              Add Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
