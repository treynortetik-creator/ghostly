"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Contact, ContactType } from "@/types/database";

interface ContactFormData {
  first_name: string;
  last_name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  contact_type: ContactType;
  notes: string;
}

interface ContactFormProps {
  contact?: Contact | null;
  onSave: (data: ContactFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: "vendor", label: "Vendor" },
  { value: "lead", label: "Lead" },
  { value: "organizer", label: "Organizer" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const inputClass =
  "w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral focus:border-transparent";

export function ContactForm({
  contact,
  onSave,
  onCancel,
  isLoading,
}: ContactFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactType, setContactType] = useState<ContactType>("other");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (contact) {
      setFirstName(contact.first_name || "");
      setLastName(contact.last_name || "");
      setCompany(contact.company || "");
      setTitle(contact.title || "");
      setEmail(contact.email || "");
      setPhone(contact.phone || "");
      setContactType(contact.contact_type || "other");
      setNotes(contact.notes || "");
    }
  }, [contact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      first_name: firstName,
      last_name: lastName,
      company,
      title,
      email,
      phone,
      contact_type: contactType,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg border border-border glass-shadow w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {contact ? "Edit Contact" : "Add Contact"}
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                First Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={inputClass}
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Last Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={inputClass}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputClass}
                placeholder="Company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="e.g., Account Executive"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="email@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Contact Type
            </label>
            <select
              value={contactType}
              onChange={(e) => setContactType(e.target.value as ContactType)}
              className={inputClass}
            >
              {CONTACT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Additional context about this contact..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {contact ? "Update" : "Add Contact"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
