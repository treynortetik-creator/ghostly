'use client';

import { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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

export function ApplyTemplateModal({ eventId, onApplied, onCancel }: ApplyTemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetch('/api/checklist-templates')
      .then(r => r.json())
      .then(data => {
        setTemplates(data.templates || []);
        const defaultTemplate = (data.templates || []).find((t: Template) => t.is_default);
        if (defaultTemplate) setSelectedId(defaultTemplate.id);
      })
      .finally(() => setIsFetching(false));
  }, []);

  const handleApply = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/checklist/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedId }),
      });
      if (res.ok) {
        onApplied();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-parchment rounded-lg border border-wood-medium/40 parchment-shadow w-full max-w-md">
        <div className="px-6 py-4 border-b border-wood-medium/20 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-wood-dark">Apply Template</h2>
          <button onClick={onCancel} className="text-sepia hover:text-wood-dark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          {isFetching ? (
            <p className="text-sm text-sepia">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-sepia">No templates available.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedId === t.id
                      ? 'border-ink-gold bg-ink-gold/5'
                      : 'border-wood-medium/20 hover:bg-parchment-dark'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={selectedId === t.id}
                    onChange={() => setSelectedId(t.id)}
                    className="sr-only"
                  />
                  <FileText className="w-5 h-5 text-wood-medium flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-wood-dark">{t.name}</p>
                    <p className="text-xs text-sepia">
                      {t.item_count} tasks
                      {t.event_type && ` · ${t.event_type}`}
                      {t.is_default && ' · Default'}
                    </p>
                  </div>
                  {selectedId === t.id && (
                    <div className="w-4 h-4 rounded-full bg-ink-gold flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-parchment" />
                    </div>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-wood-medium/20 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={handleApply}
            isLoading={isLoading}
            disabled={!selectedId || isFetching}
          >
            Apply Template
          </Button>
        </div>
      </div>
    </div>
  );
}
