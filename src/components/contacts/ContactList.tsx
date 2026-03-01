"use client";

import { Users } from "lucide-react";
import { ContactCard } from "./ContactCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Contact } from "@/types/database";

interface ContactListProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

export function ContactList({ contacts, onEdit, onDelete }: ContactListProps) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-12 h-12" />}
        title="No Contacts Yet"
        description="Add your first contact to start building your network."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
