'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import type { EventTypeRecord } from '@/types/database';

/* ============================================
   EVENT TYPE FORM COMPONENT
   ============================================
   Form for creating and editing event types.
   Used in the Settings > Event Types section.
   Victorian theme: "The Category Ledger"
   ============================================ */

export interface EventTypeFormData {
  name: string;
  budget_amount: string;
  description: string;
}

export interface EventTypeFormProps {
  /** Existing event type for edit mode */
  eventType?: EventTypeRecord;
  /** Submit handler - receives form data */
  onSubmit: (data: EventTypeFormData) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
  /** Loading state for submit button */
  isLoading?: boolean;
  /** Form mode - create or edit */
  mode?: 'create' | 'edit';
}

/**
 * Sanitize currency input - allows only numbers and single decimal point
 */
const sanitizeCurrency = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

export function EventTypeForm({
  eventType,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}: EventTypeFormProps) {
  const [formData, setFormData] = useState<EventTypeFormData>({
    name: eventType?.name || '',
    budget_amount: eventType?.budget_amount?.toString() || '0',
    description: eventType?.description || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EventTypeFormData, string>>>({});

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EventTypeFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    const budget = parseFloat(formData.budget_amount);
    if (isNaN(budget) || budget < 0) {
      newErrors.budget_amount = 'Budget must be zero or positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(formData);
  };

  /**
   * Handle field change with error clearing
   */
  const handleChange = (field: keyof EventTypeFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Shared input styles matching the Victorian theme
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
          {mode === 'create' ? 'Add Event Type' : 'Edit Event Type'}
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className={labelClasses}>
              Name <span className="text-ink-red">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={inputClasses}
              placeholder="e.g., Executive"
              disabled={isLoading}
            />
            {errors.name && <p className={errorClasses}>{errors.name}</p>}
          </div>

          {/* Budget Amount Field */}
          <div>
            <label htmlFor="budget_amount" className={labelClasses}>
              Budget Amount
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

          {/* Description Field */}
          <div>
            <label htmlFor="description" className={labelClasses}>
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className={`${inputClasses} min-h-[80px] resize-y`}
              placeholder="Brief description of this event type..."
              disabled={isLoading}
            />
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
            {mode === 'create' ? 'Add Type' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default EventTypeForm;
