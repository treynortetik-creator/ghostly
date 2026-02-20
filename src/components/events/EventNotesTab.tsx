'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Pin, PinOff, Trash2, Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDateMedium } from '@/lib/format';

/* ============================================
   EVENT NOTES TAB
   ============================================
   Shows event notes with type badges, pinning,
   add note form, and soft delete. Competitor
   alert notes get distinctive amber styling.
   ============================================ */

interface EventNote {
  id: string;
  event_id: string;
  author: string;
  note_type: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface EventNotesTabProps {
  eventId: string;
}

const noteTypeConfig: Record<string, { label: string; className: string }> = {
  competitor_alert: { label: '🎯 Competitor Alert', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40' },
  general: { label: 'General', className: 'bg-wood-medium/15 text-sepia border-wood-medium/30' },
  logistics: { label: 'Logistics', className: 'bg-ink-green/15 text-ink-green border-ink-green/30' },
  budget: { label: 'Budget', className: 'bg-ink-gold/15 text-ink-gold border-ink-gold/30' },
};

const noteTypeOptions = [
  { value: 'general', label: 'General' },
  { value: 'competitor_alert', label: 'Competitor Alert' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'budget', label: 'Budget' },
];

export function EventNotesTab({ eventId }: EventNotesTabProps) {
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNote, setNewNote] = useState({ content: '', title: '', note_type: 'general', author: 'Treynor' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAddNote = async () => {
    if (!newNote.content.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNote.content,
          title: newNote.title || undefined,
          note_type: newNote.note_type,
          author: newNote.author,
        }),
      });
      if (res.ok) {
        setNewNote({ content: '', title: '', note_type: 'general', author: 'Treynor' });
        setShowAddForm(false);
        fetchNotes();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePin = async (note: EventNote) => {
    try {
      const res = await fetch(`/api/events/${eventId}/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      if (res.ok) fetchNotes();
    } catch { /* ignore */ }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      const res = await fetch(`/api/events/${eventId}/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) fetchNotes();
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sepia">Loading notes...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-wood-dark flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-ink-gold" />
          Notes ({notes.length})
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchNotes()}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Note
          </Button>
        </div>
      </div>

      {/* Add Note Form */}
      {showAddForm && (
        <Card className="border-ink-gold/30">
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-sepia mb-1 block">Title (optional)</label>
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="Note title..."
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark placeholder:text-sepia/50 focus:border-ink-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-sepia mb-1 block">Type</label>
                <select
                  value={newNote.note_type}
                  onChange={(e) => setNewNote({ ...newNote, note_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark focus:border-ink-gold focus:outline-none"
                >
                  {noteTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-sepia mb-1 block">Content</label>
              <textarea
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                placeholder="Write your note..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-parchment-dark border border-wood-medium/30 rounded-md text-wood-dark placeholder:text-sepia/50 focus:border-ink-gold focus:outline-none resize-y"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddNote} disabled={isSubmitting || !newNote.content.trim()}>
                {isSubmitting ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sepia">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No notes yet. Add one to track important details about this event.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const typeConfig = noteTypeConfig[note.note_type] || noteTypeConfig.general;
            const isCompetitorAlert = note.note_type === 'competitor_alert';

            return (
              <Card
                key={note.id}
                className={isCompetitorAlert ? 'border-amber-500/30 bg-amber-500/5 dark:border-amber-700/40 dark:bg-amber-900/10' : ''}
              >
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Header row: type badge + title + pin icon */}
                      <div className="flex items-center gap-2 mb-1">
                        {note.pinned && (
                          <Pin className="w-3.5 h-3.5 text-ink-gold flex-shrink-0" />
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${typeConfig.className}`}>
                          {typeConfig.label}
                        </span>
                        {note.title && (
                          <span className="text-sm font-semibold text-wood-dark truncate">{note.title}</span>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-sm text-wood-dark whitespace-pre-wrap mt-1">{note.content}</p>

                      {/* Footer: author + date */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-sepia">
                        <span className="font-medium">{note.author}</span>
                        <span>·</span>
                        <span>{formatDateMedium(note.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleTogglePin(note)}
                        className="p-1.5 text-sepia hover:text-ink-gold transition-colors"
                        title={note.pinned ? 'Unpin' : 'Pin'}
                      >
                        {note.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1.5 text-sepia hover:text-ink-red transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
