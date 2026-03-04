"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, RefreshCw, Plus } from "lucide-react";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TemplateCard } from "@/components/documents/TemplateCard";
import { TemplateBuilder } from "@/components/documents/TemplateBuilder";
import { GeneratedDocRow } from "@/components/documents/GeneratedDocRow";
import { MarkdownViewer } from "@/components/documents/MarkdownViewer";
import type {
  DocumentTemplate,
  DocumentTemplateWithSections,
  DocumentWithRelations,
  SectionContentType,
} from "@/types/database";
import type { SectionData } from "@/components/documents/SortableSection";

type Tab = "templates" | "generated";

interface TemplateWithCount extends DocumentTemplate {
  section_count: number;
}

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<TemplateWithCount[]>([]);
  const [documents, setDocuments] = useState<DocumentWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<DocumentTemplateWithSections | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "template" | "document";
    id: string;
    name: string;
  } | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{
    id: string;
    filename: string;
    content: string;
  } | null>(null);

  // Seed defaults on mount (fire and forget)
  useEffect(() => {
    fetch("/api/templates/seed", { method: "POST" }).catch((err) => console.error('Template seed request failed:', err));
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents?source=generated");
      const data = await res.json();
      setDocuments(data.documents || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    if (activeTab === "templates") {
      fetchTemplates();
    } else {
      fetchDocuments();
    }
  }, [activeTab, fetchTemplates, fetchDocuments]);

  const handleEditTemplate = async (template: TemplateWithCount) => {
    const res = await fetch(`/api/templates/${template.id}`);
    if (res.ok) {
      const data = await res.json();
      setEditingTemplate(data);
      setShowBuilder(true);
    }
  };

  const handleDuplicateTemplate = async (template: TemplateWithCount) => {
    const res = await fetch(`/api/templates/${template.id}`);
    if (!res.ok) return;
    const data: DocumentTemplateWithSections = await res.json();

    const dupeRes = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${data.name} (Copy)`,
        description: data.description || "",
        sections: (data.sections || []).map(
          (s: {
            title: string;
            content_type: SectionContentType;
            ai_instructions: string | null;
            default_content: string | null;
          }) => ({
            title: s.title,
            content_type: s.content_type,
            ai_instructions: s.ai_instructions || "",
            default_content: s.default_content || "",
          })
        ),
      }),
    });

    if (dupeRes.ok) {
      fetchTemplates();
    }
  };

  const handleSaveTemplate = async (data: {
    name: string;
    description: string;
    sections: Omit<SectionData, "id">[];
  }) => {
    setIsSaving(true);
    try {
      const url = editingTemplate
        ? `/api/templates/${editingTemplate.id}`
        : "/api/templates";
      const method = editingTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setShowBuilder(false);
        setEditingTemplate(null);
        fetchTemplates();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewDocument = async (doc: DocumentWithRelations) => {
    const res = await fetch(`/api/documents/${doc.id}/download`);
    if (res.ok) {
      const content = await res.text();
      setViewerDoc({ id: doc.id, filename: doc.filename, content });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    setDeleteTarget(null);

    if (type === "template") {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      fetchTemplates();
    } else {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      fetchDocuments();
    }
  };

  const tabs: { value: Tab; label: string }[] = [
    { value: "templates", label: "Templates" },
    { value: "generated", label: "Generated" },
  ];

  const totalCount =
    activeTab === "templates" ? templates.length : documents.length;

  return (
    <AppShell>
      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.type === "template"
            ? "Delete Template"
            : "Delete Document"
        }
        message={`Remove "${deleteTarget?.name || ""}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1">
            {totalCount} {activeTab === "templates" ? "template" : "document"}
            {totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              if (activeTab === "templates") fetchTemplates();
              else fetchDocuments();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {activeTab === "templates" && (
            <Button
              onClick={() => {
                setEditingTemplate(null);
                setShowBuilder(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Template
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.value
                ? "bg-spectral/15 text-spectral font-medium"
                : "text-muted-foreground hover:bg-spectral/5 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-spectral/10 rounded-lg" />
          <div className="h-32 bg-spectral/10 rounded-lg" />
        </div>
      ) : activeTab === "templates" ? (
        templates.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="No templates yet"
            description="Create a template to define the structure for your generated documents."
            action={
              <Button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowBuilder(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create Template
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={handleEditTemplate}
                onDuplicate={handleDuplicateTemplate}
                onDelete={(t) =>
                  setDeleteTarget({
                    type: "template",
                    id: t.id,
                    name: t.name,
                  })
                }
              />
            ))}
          </div>
        )
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="No generated documents"
          description="Ask the AI agent to generate a document from one of your templates. Generated documents will appear here."
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <GeneratedDocRow
              key={doc.id}
              document={doc}
              onView={handleViewDocument}
              onDelete={(d) =>
                setDeleteTarget({
                  type: "document",
                  id: d.id,
                  name: d.filename,
                })
              }
            />
          ))}
        </div>
      )}

      {/* Template Builder Modal */}
      {showBuilder && (
        <TemplateBuilder
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => {
            setShowBuilder(false);
            setEditingTemplate(null);
          }}
          isLoading={isSaving}
        />
      )}

      {/* Markdown Viewer Modal */}
      {viewerDoc && (
        <MarkdownViewer
          documentId={viewerDoc.id}
          filename={viewerDoc.filename}
          content={viewerDoc.content}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </AppShell>
  );
}
