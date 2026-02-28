"use client";

import { useState, useEffect } from "react";
import { X, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Template {
  id: string;
  name: string;
  event_type: string | null;
  is_default: boolean;
  item_count: number;
}

interface ApplyTemplateModalProps {
  eventId: string;
  onApplied: () => void;
  onCancel: () => void;
}

export function ApplyTemplateModal({
  eventId,
  onApplied,
  onCancel,
}: ApplyTemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch("/api/checklist-templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
        const defaultTemplate = (data.templates || []).find(
          (t: Template) => t.is_default,
        );
        if (defaultTemplate) setSelectedId(defaultTemplate.id);
      })
      .finally(() => setIsFetching(false));
  }, []);

  const handleApply = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/checklist/apply-template`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_id: selectedId }),
        },
      );
      if (res.ok) {
        onApplied();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      data-oid="pmmeyga"
    >
      <div
        className="bg-background rounded-lg border border-border glass-shadow w-full max-w-md"
        data-oid="q.o1mj3"
      >
        <div
          className="px-6 py-4 border-b border-border flex items-center justify-between"
          data-oid=".h5o8e4"
        >
          <h2
            className="text-xl font-semibold text-foreground"
            data-oid="bwzu2w6"
          >
            Apply Template
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
            data-oid="-ya.h:d"
          >
            <X className="w-5 h-5" data-oid="k1r9_wx" />
          </button>
        </div>

        <div className="px-6 py-4" data-oid="34-z0dw">
          {isFetching ? (
            <p className="text-sm text-muted-foreground" data-oid="y570jsl">
              Loading templates...
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-oid="onymwty">
              No templates available.
            </p>
          ) : (
            <div className="space-y-2" data-oid="l57_zdk">
              {templates.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedId === t.id
                      ? "border-spectral bg-spectral/10"
                      : "border-border hover:bg-card"
                  }`}
                  data-oid="1rim31-"
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={selectedId === t.id}
                    onChange={() => setSelectedId(t.id)}
                    className="sr-only"
                    data-oid="ezw5sl2"
                  />

                  <FileText
                    className="w-5 h-5 text-muted-foreground flex-shrink-0"
                    data-oid="w3q7nt7"
                  />
                  <div className="flex-1" data-oid=".5anetz">
                    <p
                      className="text-sm font-medium text-foreground"
                      data-oid="2l3to5m"
                    >
                      {t.name}
                    </p>
                    <p className="text-xs text-muted-foreground" data-oid="fr7f7es">
                      {t.item_count} tasks
                      {t.event_type && ` · ${t.event_type}`}
                      {t.is_default && " · Default"}
                    </p>
                  </div>
                  {selectedId === t.id && (
                    <div
                      className="w-4 h-4 rounded-full bg-spectral flex items-center justify-center"
                      data-oid="79pp27_"
                    >
                      <div
                        className="w-2 h-2 rounded-full bg-background"
                        data-oid="svqtgr."
                      />
                    </div>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 border-t border-border flex justify-end gap-3"
          data-oid="q_hwf0k"
        >
          <Button variant="secondary" onClick={onCancel} data-oid="rnhpm3u">
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            isLoading={isLoading}
            disabled={!selectedId || isFetching}
            data-oid="9:4gfz5"
          >
            Apply Template
          </Button>
        </div>
      </div>
    </div>
  );
}
