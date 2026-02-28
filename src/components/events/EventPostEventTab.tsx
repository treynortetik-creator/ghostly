'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Plus, RefreshCw, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDateMedium } from '@/lib/format';

/* ============================================
   EVENT POST-EVENT TAB
   ============================================
   Shows structured post-event debrief form
   plus free-form post-event notes list.
   Each debrief section saves as a separate
   note with note_type='post_event'.
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

interface EventPostEventTabProps {
  eventId: string;
}

const debriefSections = [
  { title: 'What Went Well', key: 'went_well', placeholder: 'What aspects of this event were successful?' },
  { title: 'What Could Improve', key: 'could_improve', placeholder: 'What could be done better next time?' },
  { title: 'Key Contacts Made', key: 'contacts_made', placeholder: 'Important new contacts or relationships formed' },
  { title: 'Follow-up Actions', key: 'follow_up', placeholder: 'Required next steps and action items' },
];

export function EventPostEventTab({ eventId }: EventPostEventTabProps) {
  const [notes, setNotes] = useState<EventNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNote, setNewNote] = useState({ content: '', title: '', author: 'Treynor' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debriefForm, setDebriefForm] = useState<Record<string, string>>({
    went_well: '',
    could_improve: '',
    contacts_made: '',
    follow_up: '',
  });
  const [isSavingDebrief, setIsSavingDebrief] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/notes?note_type=post_event`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
        
        // Pre-populate debrief form with existing structured notes
        const existingDebrief: Record<string, string> = {};
        debriefSections.forEach(section => {
          const existingNote = (data.notes || []).find((note: EventNote) => 
            note.title === section.title
          );
          existingDebrief[section.key] = existingNote?.content || '';
        });
        setDebriefForm(existingDebrief);
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSaveDebrief = async () => {
    setIsSavingDebrief(true);
    try {
      // Save each non-empty debrief section as a separate note
      const savePromises = debriefSections.map(async (section) => {
        const content = debriefForm[section.key]?.trim();
        if (!content) return;

        // Check if note already exists for this section
        const existingNote = notes.find(note => note.title === section.title);
        
        if (existingNote) {
          // Update existing note
          const res = await fetch(`/api/events/${eventId}/notes/${existingNote.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          });
          return res.ok;
        } else {
          // Create new note
          const res = await fetch(`/api/events/${eventId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              title: section.title,
              note_type: 'post_event',
              author: 'Treynor',
            }),
          });
          return res.ok;
        }
      });

      await Promise.all(savePromises);
      fetchNotes();
    } finally {
      setIsSavingDebrief(false);
    }
  };

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
          note_type: 'post_event',
          author: newNote.author,
        }),
      });
      if (res.ok) {
        setNewNote({ content: '', title: '', author: 'Treynor' });
        setShowAddForm(false);
        fetchNotes();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    setDeleteConfirmId(null);
    try {
      const res = await fetch(`/api/events/${eventId}/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) fetchNotes();
    } catch { /* ignore */ }
  };

  const freeFormNotes = notes.filter(note => 
    !debriefSections.some(section => section.title === note.title)
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading post-event notes...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete Note"
        message="Delete this note?"
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteConfirmId) handleDelete(deleteConfirmId); }}
        onCancel={() => setDeleteConfirmId(null)}
      />
      {/* Structured Debrief Form */}
      <Card className="border-spectral">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-spectral" />
            Post-Event Debrief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {debriefSections.map((section) => (
            <div key={section.key}>
              <label className="text-sm font-medium text-foreground mb-1 block">
                {section.title}
              </label>
              <textarea
                value={debriefForm[section.key] || ''}
                onChange={(e) => setDebriefForm({ ...debriefForm, [section.key]: e.target.value })}
                placeholder={section.placeholder}
                rows={4}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none resize-y"
              />
            </div>
          ))}
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveDebrief}
              disabled={isSavingDebrief}
              className="w-full sm:w-auto"
            >
              {isSavingDebrief ? 'Saving Debrief...' : 'Save Debrief'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Free-form Notes Section */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-spectral" />
            Additional Post-Event Notes ({freeFormNotes.length})
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
          <Card className="border-spectral">
            <CardContent className="py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title (optional)</label>
                <input
                  type="text"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  placeholder="Note title..."
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Content</label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  placeholder="Write your post-event note..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/60 focus:border-spectral focus:outline-none resize-y"
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
        {freeFormNotes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No additional post-event notes yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {freeFormNotes.map((note) => (
              <Card key={note.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Header row: type badge + title */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border bg-emerald-400/10 text-emerald-400 border-emerald-400/30">
                          Post-Event
                        </span>
                        {note.title && (
                          <span className="text-sm font-semibold text-foreground truncate">{note.title}</span>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{note.content}</p>

                      {/* Footer: author + date */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="font-medium">{note.author}</span>
                        <span>·</span>
                        <span>{formatDateMedium(note.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setDeleteConfirmId(note.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}