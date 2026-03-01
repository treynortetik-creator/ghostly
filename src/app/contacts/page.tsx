"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ContactList } from "@/components/contacts/ContactList";
import { ContactForm } from "@/components/contacts/ContactForm";
import type { Contact, ContactType } from "@/types/database";

const FILTER_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "vendor", label: "Vendors" },
  { value: "lead", label: "Leads" },
  { value: "organizer", label: "Organizers" },
  { value: "partner", label: "Partners" },
  { value: "other", label: "Other" },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  const fetchContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterType !== "all") params.set("contact_type", filterType);
      const qs = params.toString();
      const res = await fetch(`/api/contacts${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      setContacts(data.contacts || []);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterType]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSave = async (formData: {
    first_name: string;
    last_name: string;
    company: string;
    title: string;
    email: string;
    phone: string;
    contact_type: ContactType;
    notes: string;
  }) => {
    setIsSaving(true);
    try {
      const url = editingContact
        ? `/api/contacts/${editingContact.id}`
        : "/api/contacts";
      const method = editingContact ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingContact(null);
        fetchContacts();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleDelete = (contact: Contact) => {
    setDeleteTarget(contact);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const contact = deleteTarget;
    setDeleteTarget(null);
    await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
    fetchContacts();
  };

  return (
    <AppShell>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove Contact"
        message={`Remove ${deleteTarget?.first_name || ""} ${deleteTarget?.last_name || ""} from your contacts?`}
        variant="danger"
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contacts</h1>
          <p className="text-muted-foreground mt-1">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in your
            network
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              fetchContacts();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setEditingContact(null);
              setShowForm(true);
            }}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Add Contact
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsLoading(true);
            }}
            placeholder="Search contacts..."
            className="w-full pl-10 pr-3 py-2 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-spectral focus:border-transparent"
          />
        </div>
        <div className="flex gap-1">
          {FILTER_TYPES.map((ft) => (
            <button
              key={ft.value}
              onClick={() => {
                setFilterType(ft.value);
                setIsLoading(true);
              }}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                filterType === ft.value
                  ? "bg-spectral/15 text-spectral font-medium"
                  : "text-muted-foreground hover:bg-spectral/5 hover:text-foreground"
              }`}
            >
              {ft.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-spectral/10 rounded-lg" />
          <div className="h-32 bg-spectral/10 rounded-lg" />
        </div>
      ) : (
        <ContactList
          contacts={contacts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <ContactForm
          contact={editingContact}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingContact(null);
          }}
          isLoading={isSaving}
        />
      )}
    </AppShell>
  );
}
