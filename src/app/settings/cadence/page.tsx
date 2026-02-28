'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Plus, Edit, Trash2, ChevronDown, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/Card';
import type { CadenceTemplate, CadenceMilestone, CadenceTemplateWithMilestones, NotifyChannel, EventTypeRecord } from '@/types/database';

/* ============================================
   CADENCE TEMPLATE MANAGEMENT PAGE
   ============================================
   "The Cadence Registry"
   Manage cadence templates and their milestones
   for event reminder scheduling.
   ============================================ */

const inputClasses = `
  w-full px-4 py-2.5 rounded-md
  bg-background border border-border
  text-foreground placeholder-muted-foreground/50
  focus:outline-none focus:ring-2 focus:ring-spectral/50 focus:border-spectral
  transition-colors duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
`;

const labelClasses = 'block text-sm font-medium text-foreground mb-1.5';

interface MilestoneFormData {
  offset_days: string;
  title: string;
  description: string;
  notify_channel: NotifyChannel;
  display_order: string;
}

const emptyMilestoneForm: MilestoneFormData = {
  offset_days: '',
  title: '',
  description: '',
  notify_channel: 'in_app',
  display_order: '0',
};

function formatOffsetDays(days: number): string {
  if (days === 0) return 'Day of event';
  const abs = Math.abs(days);
  const unit = abs === 1 ? 'day' : 'days';
  return days < 0 ? `${abs} ${unit} before` : `${abs} ${unit} after`;
}

function offsetColor(days: number): string {
  if (days < 0) return 'text-muted-foreground';
  if (days === 0) return 'text-spectral';
  return 'text-emerald-400';
}

const notifyChannelLabels: Record<NotifyChannel, string> = {
  agent: 'AI Agent',
  in_app: 'In-App',
  both: 'Both',
};

export default function CadenceRegistryPage() {
  const [templates, setTemplates] = useState<CadenceTemplateWithMilestones[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Template form state
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateEventTypeId, setNewTemplateEventTypeId] = useState('');
  const [newTemplateIsDefault, setNewTemplateIsDefault] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Edit template state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateEventTypeId, setEditTemplateEventTypeId] = useState('');
  const [editTemplateIsDefault, setEditTemplateIsDefault] = useState(false);

  // Expanded templates (to show milestones)
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());

  // Milestone form state
  const [addingMilestoneToTemplate, setAddingMilestoneToTemplate] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormData>(emptyMilestoneForm);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMilestoneForm, setEditMilestoneForm] = useState<MilestoneFormData>(emptyMilestoneForm);
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteMilestone, setDeleteMilestone] = useState<{ templateId: string; milestoneId: string } | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cadence-templates');
      if (!res.ok) throw new Error('Failed to fetch cadence templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEventTypes = useCallback(async () => {
    try {
      const settingsRes = await fetch('/api/settings');
      if (!settingsRes.ok) return;
      const settingsData = await settingsRes.json();
      const fyId = settingsData.settings?.fiscal_year_id;
      if (!fyId) return;

      const res = await fetch(`/api/event-types?fiscal_year_id=${fyId}`);
      if (res.ok) {
        const data = await res.json();
        setEventTypes(data.event_types || []);
      }
    } catch {
      // Silently fail — event types are optional for display
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchEventTypes();
  }, [fetchTemplates, fetchEventTypes]);

  // Toggle template expansion
  const toggleExpand = (templateId: string) => {
    setExpandedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  };

  // Create template
  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setIsSavingTemplate(true);
    try {
      const res = await fetch('/api/cadence-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          event_type_id: newTemplateEventTypeId || null,
          is_default: newTemplateIsDefault,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create template');
      }
      setShowNewTemplate(false);
      setNewTemplateName('');
      setNewTemplateEventTypeId('');
      setNewTemplateIsDefault(false);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Update template
  const handleUpdateTemplate = async (templateId: string) => {
    if (!editTemplateName.trim()) return;
    setIsSavingTemplate(true);
    try {
      const res = await fetch(`/api/cadence-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTemplateName.trim(),
          event_type_id: editTemplateEventTypeId || null,
          is_default: editTemplateIsDefault,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update template');
      }
      setEditingTemplateId(null);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    setDeleteTemplateId(null);
    try {
      const res = await fetch(`/api/cadence-templates/${templateId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete template');
      }
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  // Start editing a template
  const startEditTemplate = (template: CadenceTemplateWithMilestones) => {
    setEditingTemplateId(template.id);
    setEditTemplateName(template.name);
    setEditTemplateEventTypeId(template.event_type_id || '');
    setEditTemplateIsDefault(template.is_default);
  };

  // Create milestone
  const handleCreateMilestone = async (templateId: string) => {
    if (!milestoneForm.title.trim() || milestoneForm.offset_days === '') return;
    setIsSavingMilestone(true);
    try {
      const res = await fetch(`/api/cadence-templates/${templateId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset_days: parseInt(milestoneForm.offset_days),
          title: milestoneForm.title.trim(),
          description: milestoneForm.description.trim() || null,
          notify_channel: milestoneForm.notify_channel,
          display_order: parseInt(milestoneForm.display_order) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create milestone');
      }
      setAddingMilestoneToTemplate(null);
      setMilestoneForm(emptyMilestoneForm);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create milestone');
    } finally {
      setIsSavingMilestone(false);
    }
  };

  // Update milestone
  const handleUpdateMilestone = async (templateId: string, milestoneId: string) => {
    if (!editMilestoneForm.title.trim() || editMilestoneForm.offset_days === '') return;
    setIsSavingMilestone(true);
    try {
      const res = await fetch(`/api/cadence-templates/${templateId}/milestones/${milestoneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset_days: parseInt(editMilestoneForm.offset_days),
          title: editMilestoneForm.title.trim(),
          description: editMilestoneForm.description.trim() || null,
          notify_channel: editMilestoneForm.notify_channel,
          display_order: parseInt(editMilestoneForm.display_order) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update milestone');
      }
      setEditingMilestoneId(null);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update milestone');
    } finally {
      setIsSavingMilestone(false);
    }
  };

  // Delete milestone
  const handleDeleteMilestone = async (templateId: string, milestoneId: string) => {
    setDeleteMilestone(null);
    try {
      const res = await fetch(`/api/cadence-templates/${templateId}/milestones/${milestoneId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete milestone');
      }
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete milestone');
    }
  };

  // Start editing a milestone
  const startEditMilestone = (milestone: CadenceMilestone) => {
    setEditingMilestoneId(milestone.id);
    setEditMilestoneForm({
      offset_days: milestone.offset_days.toString(),
      title: milestone.title,
      description: milestone.description || '',
      notify_channel: milestone.notify_channel,
      display_order: milestone.display_order.toString(),
    });
  };

  const getEventTypeName = (eventTypeId: string | null) => {
    if (!eventTypeId) return null;
    return eventTypes.find(et => et.id === eventTypeId)?.name || null;
  };

  return (
    <AppShell>
      <ConfirmDialog
        open={deleteTemplateId !== null}
        title="Delete Cadence Template"
        message="Delete this cadence template and all its milestones?"
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTemplateId) handleDeleteTemplate(deleteTemplateId); }}
        onCancel={() => setDeleteTemplateId(null)}
      />
      <ConfirmDialog
        open={deleteMilestone !== null}
        title="Delete Milestone"
        message="Delete this milestone?"
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => { if (deleteMilestone) handleDeleteMilestone(deleteMilestone.templateId, deleteMilestone.milestoneId); }}
        onCancel={() => setDeleteMilestone(null)}
      />
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Settings
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Clock className="w-8 h-8 text-spectral" />
            The Cadence Registry
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage reminder schedules for your events
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { fetchTemplates(); fetchEventTypes(); }}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowNewTemplate(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Template
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-400/10 border border-destructive/30 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-destructive hover:text-destructive/70">
            &times;
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-spectral animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Loading cadence templates...</p>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="space-y-6">
          {/* New Template Form */}
          {showNewTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Cadence Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="new-template-name" className={labelClasses}>
                    Template Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    id="new-template-name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className={inputClasses}
                    placeholder="e.g., Standard Conference Cadence"
                    disabled={isSavingTemplate}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="new-template-event-type" className={labelClasses}>
                      Event Type
                    </label>
                    <select
                      id="new-template-event-type"
                      value={newTemplateEventTypeId}
                      onChange={(e) => setNewTemplateEventTypeId(e.target.value)}
                      className={inputClasses}
                      disabled={isSavingTemplate}
                    >
                      <option value="">All event types</option>
                      {eventTypes.map(et => (
                        <option key={et.id} value={et.id}>{et.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplateIsDefault}
                        onChange={(e) => setNewTemplateIsDefault(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-spectral focus:ring-spectral/50"
                        disabled={isSavingTemplate}
                      />
                      <span className="text-sm text-foreground">Set as default template</span>
                    </label>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowNewTemplate(false);
                    setNewTemplateName('');
                    setNewTemplateEventTypeId('');
                    setNewTemplateIsDefault(false);
                  }}
                  disabled={isSavingTemplate}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateTemplate}
                  isLoading={isSavingTemplate}
                  disabled={!newTemplateName.trim()}
                >
                  Create Template
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Templates List */}
          {templates.length === 0 && !showNewTemplate ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Clock className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                  <p className="text-muted-foreground">No cadence templates yet.</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    Create a template to define reminder schedules for your events.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowNewTemplate(true)}
                    className="mt-4"
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Create First Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            templates.map(template => (
              <Card key={template.id}>
                {/* Template Header */}
                <CardHeader>
                  {editingTemplateId === template.id ? (
                    /* Edit Template Form */
                    <div className="space-y-4">
                      <div>
                        <label className={labelClasses}>
                          Template Name <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="text"
                          value={editTemplateName}
                          onChange={(e) => setEditTemplateName(e.target.value)}
                          className={inputClasses}
                          disabled={isSavingTemplate}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClasses}>Event Type</label>
                          <select
                            value={editTemplateEventTypeId}
                            onChange={(e) => setEditTemplateEventTypeId(e.target.value)}
                            className={inputClasses}
                            disabled={isSavingTemplate}
                          >
                            <option value="">All event types</option>
                            {eventTypes.map(et => (
                              <option key={et.id} value={et.id}>{et.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editTemplateIsDefault}
                              onChange={(e) => setEditTemplateIsDefault(e.target.checked)}
                              className="w-4 h-4 rounded border-border text-spectral focus:ring-spectral/50"
                              disabled={isSavingTemplate}
                            />
                            <span className="text-sm text-foreground">Default template</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingTemplateId(null)}
                          disabled={isSavingTemplate}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleUpdateTemplate(template.id)}
                          isLoading={isSavingTemplate}
                          disabled={!editTemplateName.trim()}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Template Display */
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleExpand(template.id)}
                      >
                        {expandedTemplates.has(template.id) ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {template.name}
                            {template.is_default && (
                              <span className="text-xs px-2 py-0.5 rounded bg-spectral/10 text-spectral border border-spectral">
                                Default
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription>
                            {getEventTypeName(template.event_type_id) || 'All event types'}
                            {' '}&middot;{' '}
                            {template.milestone_count} milestone{template.milestone_count !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startEditTemplate(template)}
                          aria-label="Edit template"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTemplateId(template.id)}
                          aria-label="Delete template"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardHeader>

                {/* Milestones Section */}
                {expandedTemplates.has(template.id) && editingTemplateId !== template.id && (
                  <CardContent className="pt-0">
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-foreground">Milestones</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAddingMilestoneToTemplate(template.id);
                            setMilestoneForm(emptyMilestoneForm);
                          }}
                          leftIcon={<Plus className="w-3 h-3" />}
                        >
                          Add Milestone
                        </Button>
                      </div>

                      {/* Milestones List */}
                      {template.milestones.length === 0 && addingMilestoneToTemplate !== template.id && (
                        <p className="text-sm text-muted-foreground/60 text-center py-4">
                          No milestones yet. Add milestones to define the reminder schedule.
                        </p>
                      )}

                      <div className="space-y-2">
                        {[...template.milestones]
                          .sort((a, b) => a.offset_days - b.offset_days)
                          .map(milestone => (
                            <div key={milestone.id}>
                              {editingMilestoneId === milestone.id ? (
                                /* Edit Milestone Inline Form */
                                <div className="p-3 rounded-lg bg-background border border-spectral space-y-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-foreground mb-1">
                                        Offset Days <span className="text-destructive">*</span>
                                      </label>
                                      <input
                                        type="number"
                                        value={editMilestoneForm.offset_days}
                                        onChange={(e) => setEditMilestoneForm(f => ({ ...f, offset_days: e.target.value }))}
                                        className={inputClasses}
                                        placeholder="-14"
                                        disabled={isSavingMilestone}
                                      />
                                      <p className="text-xs text-muted-foreground/60 mt-0.5">Negative = before event</p>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-foreground mb-1">
                                        Title <span className="text-destructive">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={editMilestoneForm.title}
                                        onChange={(e) => setEditMilestoneForm(f => ({ ...f, title: e.target.value }))}
                                        className={inputClasses}
                                        disabled={isSavingMilestone}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-foreground mb-1">Channel</label>
                                      <select
                                        value={editMilestoneForm.notify_channel}
                                        onChange={(e) => setEditMilestoneForm(f => ({ ...f, notify_channel: e.target.value as NotifyChannel }))}
                                        className={inputClasses}
                                        disabled={isSavingMilestone}
                                      >
                                        <option value="in_app">In-App</option>
                                        <option value="agent">AI Agent</option>
                                        <option value="both">Both</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                                    <input
                                      type="text"
                                      value={editMilestoneForm.description}
                                      onChange={(e) => setEditMilestoneForm(f => ({ ...f, description: e.target.value }))}
                                      className={inputClasses}
                                      placeholder="Optional description"
                                      disabled={isSavingMilestone}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setEditingMilestoneId(null)}
                                      disabled={isSavingMilestone}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleUpdateMilestone(template.id, milestone.id)}
                                      isLoading={isSavingMilestone}
                                      disabled={!editMilestoneForm.title.trim() || editMilestoneForm.offset_days === ''}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                /* Milestone Display Row */
                                <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-border transition-colors">
                                  <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <span className={`text-sm font-medium tabular-nums whitespace-nowrap ${offsetColor(milestone.offset_days)}`}>
                                      {formatOffsetDays(milestone.offset_days)}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-medium text-foreground truncate">{milestone.title}</p>
                                      {milestone.description && (
                                        <p className="text-xs text-muted-foreground truncate">{milestone.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2">
                                    <span className="text-xs px-2 py-0.5 rounded bg-spectral/10 text-muted-foreground whitespace-nowrap">
                                      {notifyChannelLabels[milestone.notify_channel]}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => startEditMilestone(milestone)}
                                      aria-label="Edit milestone"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => setDeleteMilestone({ templateId: template.id, milestoneId: milestone.id })}
                                      aria-label="Delete milestone"
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                        {/* Add Milestone Inline Form */}
                        {addingMilestoneToTemplate === template.id && (
                          <div className="p-3 rounded-lg bg-background border border-spectral space-y-3 mt-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                  Offset Days <span className="text-destructive">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={milestoneForm.offset_days}
                                  onChange={(e) => setMilestoneForm(f => ({ ...f, offset_days: e.target.value }))}
                                  className={inputClasses}
                                  placeholder="-14"
                                  disabled={isSavingMilestone}
                                />
                                <p className="text-xs text-muted-foreground/60 mt-0.5">Negative = before event</p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-foreground mb-1">
                                  Title <span className="text-destructive">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={milestoneForm.title}
                                  onChange={(e) => setMilestoneForm(f => ({ ...f, title: e.target.value }))}
                                  className={inputClasses}
                                  placeholder="e.g., Confirm venue booking"
                                  disabled={isSavingMilestone}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-foreground mb-1">Channel</label>
                                <select
                                  value={milestoneForm.notify_channel}
                                  onChange={(e) => setMilestoneForm(f => ({ ...f, notify_channel: e.target.value as NotifyChannel }))}
                                  className={inputClasses}
                                  disabled={isSavingMilestone}
                                >
                                  <option value="in_app">In-App</option>
                                  <option value="agent">AI Agent</option>
                                  <option value="both">Both</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                              <input
                                type="text"
                                value={milestoneForm.description}
                                onChange={(e) => setMilestoneForm(f => ({ ...f, description: e.target.value }))}
                                className={inputClasses}
                                placeholder="Optional description"
                                disabled={isSavingMilestone}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setAddingMilestoneToTemplate(null)}
                                disabled={isSavingMilestone}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleCreateMilestone(template.id)}
                                isLoading={isSavingMilestone}
                                disabled={!milestoneForm.title.trim() || milestoneForm.offset_days === ''}
                              >
                                Add Milestone
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-6 mt-8 border-t border-border">
        <p className="text-xs text-muted-foreground/60 italic">
          &ldquo;Punctuality is the politeness of kings.&rdquo; &mdash; Louis XVIII
        </p>
      </div>
    </AppShell>
  );
}
