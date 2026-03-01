"use client";

import { User, Mail, Phone, Building2, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Contact } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  vendor: "Vendor",
  lead: "Lead",
  organizer: "Organizer",
  partner: "Partner",
  other: "Contact",
};

const TYPE_COLORS: Record<string, string> = {
  vendor: "bg-blue-500/15 text-blue-400",
  lead: "bg-emerald-500/15 text-emerald-400",
  organizer: "bg-amber-500/15 text-amber-400",
  partner: "bg-purple-500/15 text-purple-400",
  other: "bg-muted-foreground/15 text-muted-foreground",
};

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

export function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  const fullName = `${contact.first_name} ${contact.last_name}`;

  return (
    <Card elevated className="relative">
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-spectral/10 flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">{fullName}</h3>
              {contact.title && (
                <p className="text-sm text-muted-foreground italic">{contact.title}</p>
              )}
              {contact.company && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{contact.company}</span>
                </div>
              )}
              <div className="flex flex-col gap-1 mt-2">
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </div>
              {contact.notes && (
                <p className="text-xs text-muted-foreground/60 mt-2 line-clamp-2">
                  {contact.notes}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(contact)}
              aria-label="Edit contact"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDelete(contact)}
              aria-label="Delete contact"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
        <span
          className={`absolute top-3 right-14 text-xs px-2 py-0.5 rounded ${
            TYPE_COLORS[contact.contact_type] || TYPE_COLORS.other
          }`}
        >
          {TYPE_LABELS[contact.contact_type] || "Contact"}
        </span>
      </CardContent>
    </Card>
  );
}
