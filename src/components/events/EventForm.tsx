'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import type { Event, QuarterType, EventTypeRecord } from '@/types/database';
import { quarterLabels } from '@/types/database';

/* ============================================
   EVENT FORM COMPONENT
   ============================================
   Victorian-styled form for creating and editing events.
   Supports both create and edit modes.
   ============================================ */

export interface EventFormData {
  name: string;
  event_type_id: string;
  quarter: QuarterType;
  fiscal_year_id: string;
  date_start: string;
  date_end: string;
  location: string;
  budget_amount: string;
  expansion_goal: string;
  net_new_goal: string;
  approach_notes: string;
  marketing_notes: string;
  sales_notes: string;
}

export interface EventFormProps {
  /** Initial event data for editing */
  event?: Event;
  /** Called when form is submitted successfully */
  onSubmit: (data: EventFormData) => Promise<void>;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether the form is in a loading state */
  isLoading?: boolean;
  /** Form mode */
  mode?: 'create' | 'edit';
}

const quarters: QuarterType[] = ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'];

// Helper to sanitize currency input - only allows one decimal point
const sanitizeCurrency = (value: string): string => {
  // Remove all non-numeric except decimal points
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    // Keep only first decimal point
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

export function EventForm({
  event,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}: EventFormProps) {
  const [eventTypes, setEventTypes] = useState<EventTypeRecord[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  const [formData, setFormData] = useState<EventFormData>({
    name: event?.name || '',
    event_type_id: event?.event_type_id || '',
    quarter: event?.quarter || 'TBD',
    fiscal_year_id: event?.fiscal_year_id || '',
    date_start: event?.date_start || '',
    date_end: event?.date_end || '',
    location: event?.location || '',
    budget_amount: event?.budget_amount?.toString() || '',
    expansion_goal: event?.expansion_goal?.toString() || '0',
    net_new_goal: event?.net_new_goal?.toString() || '0',
    approach_notes: event?.approach_notes || '',
    marketing_notes: event?.marketing_notes || '',
    sales_notes: event?.sales_notes || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        // Get fiscal year from form or fetch current settings
        let fyId = formData.fiscal_year_id;
        if (!fyId) {
          const settingsRes = await fetch('/api/settings');
          if (settingsRes.ok) {
            const settingsData = await settingsRes.json();
            fyId = settingsData.settings?.fiscal_year_id;
          }
        }

        if (fyId) {
          const res = await fetch(`/api/event-types?fiscal_year_id=${fyId}`);
          if (res.ok) {
            const data = await res.json();
            setEventTypes(data.event_types || []);
          }
        }
      } catch (err) {
        console.error('Failed to load event types:', err);
      } finally {
        setLoadingTypes(false);
      }
    };
    fetchEventTypes();
  }, [formData.fiscal_year_id]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EventFormData, string>> = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Event name is required';
    }

    if (!formData.budget_amount.trim()) {
      newErrors.budget_amount = 'Budget amount is required';
    } else {
      const budget = parseFloat(formData.budget_amount);
      if (isNaN(budget) || budget < 0) {
        newErrors.budget_amount = 'Budget must be a positive number';
      }
    }

    // Date validation
    if (formData.date_start && formData.date_end) {
      if (new Date(formData.date_end) < new Date(formData.date_start)) {
        newErrors.date_end = 'End date must be after start date';
      }
    }

    // Goal validation
    if (formData.expansion_goal) {
      const goal = parseInt(formData.expansion_goal);
      if (isNaN(goal) || goal < 0) {
        newErrors.expansion_goal = 'Goal must be a positive number';
      }
    }

    if (formData.net_new_goal) {
      const goal = parseInt(formData.net_new_goal);
      if (isNaN(goal) || goal < 0) {
        newErrors.net_new_goal = 'Goal must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit(formData);
  };

  const handleChange = (field: keyof EventFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const inputClasses = `
    w-full px-4 py-2.5 rounded-md
    bg-parchment border border-wood-medium/40
    text-ink-black placeholder-sepia/50
    focus:outline-none focus:ring-2 focus:ring-ink-gold/50 focus:border-ink-gold
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const labelClasses = 'block text-sm font-medium text-wood-dark mb-1.5';

  const errorClasses = 'text-xs text-ink-red mt-1';

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? 'Register New Event' : 'Edit Event Details'}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-wood-dark border-b border-wood-medium/20 pb-2">
              Basic Information
            </h4>

            {/* Event Name */}
            <div>
              <label htmlFor="name" className={labelClasses}>
                Event Name <span className="text-ink-red">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={inputClasses}
                placeholder="e.g., NIC Spring Conference"
                disabled={isLoading}
              />
              {errors.name && <p className={errorClasses}>{errors.name}</p>}
            </div>

            {/* Event Type and Quarter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="event_type_id" className={labelClasses}>
                  Event Type <span className="text-ink-red">*</span>
                </label>
                <select
                  id="event_type_id"
                  value={formData.event_type_id}
                  onChange={(e) => handleChange('event_type_id', e.target.value)}
                  className={inputClasses}
                  disabled={isLoading || loadingTypes}
                >
                  <option value="">Select event type...</option>
                  {eventTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quarter" className={labelClasses}>
                  Quarter <span className="text-ink-red">*</span>
                </label>
                <select
                  id="quarter"
                  value={formData.quarter}
                  onChange={(e) => handleChange('quarter', e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                >
                  {quarters.map(q => (
                    <option key={q} value={q}>
                      {quarterLabels[q]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date_start" className={labelClasses}>
                  Start Date
                </label>
                <input
                  type="date"
                  id="date_start"
                  value={formData.date_start}
                  onChange={(e) => handleChange('date_start', e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="date_end" className={labelClasses}>
                  End Date
                </label>
                <input
                  type="date"
                  id="date_end"
                  value={formData.date_end}
                  onChange={(e) => handleChange('date_end', e.target.value)}
                  className={inputClasses}
                  disabled={isLoading}
                />
                {errors.date_end && <p className={errorClasses}>{errors.date_end}</p>}
              </div>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className={labelClasses}>
                Location
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className={inputClasses}
                placeholder="e.g., San Diego, CA"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Budget Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-wood-dark border-b border-wood-medium/20 pb-2">
              Budget & Goals
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="budget_amount" className={labelClasses}>
                  Budget Amount <span className="text-ink-red">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sepia">$</span>
                  <input
                    type="text"
                    id="budget_amount"
                    value={formData.budget_amount}
                    onChange={(e) => handleChange('budget_amount', sanitizeCurrency(e.target.value))}
                    className={`${inputClasses} pl-7`}
                    placeholder="0.00"
                    disabled={isLoading}
                  />
                </div>
                {errors.budget_amount && <p className={errorClasses}>{errors.budget_amount}</p>}
              </div>

              <div>
                <label htmlFor="expansion_goal" className={labelClasses}>
                  Expansion Goal
                </label>
                <input
                  type="number"
                  id="expansion_goal"
                  value={formData.expansion_goal}
                  onChange={(e) => handleChange('expansion_goal', e.target.value)}
                  className={inputClasses}
                  placeholder="0"
                  min="0"
                  disabled={isLoading}
                />
                {errors.expansion_goal && <p className={errorClasses}>{errors.expansion_goal}</p>}
              </div>

              <div>
                <label htmlFor="net_new_goal" className={labelClasses}>
                  Net New Goal
                </label>
                <input
                  type="number"
                  id="net_new_goal"
                  value={formData.net_new_goal}
                  onChange={(e) => handleChange('net_new_goal', e.target.value)}
                  className={inputClasses}
                  placeholder="0"
                  min="0"
                  disabled={isLoading}
                />
                {errors.net_new_goal && <p className={errorClasses}>{errors.net_new_goal}</p>}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-wood-dark border-b border-wood-medium/20 pb-2">
              Planning Notes
            </h4>

            <div>
              <label htmlFor="approach_notes" className={labelClasses}>
                Approach Notes
              </label>
              <textarea
                id="approach_notes"
                value={formData.approach_notes}
                onChange={(e) => handleChange('approach_notes', e.target.value)}
                className={`${inputClasses} min-h-[80px] resize-y`}
                placeholder="Strategy and approach for this event..."
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="marketing_notes" className={labelClasses}>
                  Marketing Notes
                </label>
                <textarea
                  id="marketing_notes"
                  value={formData.marketing_notes}
                  onChange={(e) => handleChange('marketing_notes', e.target.value)}
                  className={`${inputClasses} min-h-[80px] resize-y`}
                  placeholder="Booth details, collateral needs..."
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="sales_notes" className={labelClasses}>
                  Sales Notes
                </label>
                <textarea
                  id="sales_notes"
                  value={formData.sales_notes}
                  onChange={(e) => handleChange('sales_notes', e.target.value)}
                  className={`${inputClasses} min-h-[80px] resize-y`}
                  placeholder="Target accounts, meeting schedules..."
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
          >
            {mode === 'create' ? 'Create Event' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default EventForm;
