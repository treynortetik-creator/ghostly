'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar, FolderOpen, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ============================================
   ASSIGNMENT SELECTOR COMPONENT
   ============================================
   Dropdown to select event or category assignment
   for imported transactions. Shows AI confidence
   and allows overriding suggestions.
   ============================================ */

export interface AssignmentOption {
  id: string;
  name: string;
  type: 'event' | 'category';
  eventType?: string;
  quarter?: string;
}

interface AssignmentSelectorProps {
  value: AssignmentOption | null;
  options: AssignmentOption[];
  onChange: (option: AssignmentOption | null) => void;
  aiSuggested?: boolean;
  aiConfidence?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AssignmentSelector({
  value,
  options,
  onChange,
  aiSuggested = false,
  aiConfidence,
  placeholder = 'Select assignment...',
  disabled = false,
  className,
}: AssignmentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group options by type
  const events = filteredOptions.filter((o) => o.type === 'event');
  const categories = filteredOptions.filter((o) => o.type === 'category');

  const handleSelect = (option: AssignmentOption) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-sepia';
    if (confidence >= 0.8) return 'text-ink-green';
    if (confidence >= 0.5) return 'text-ink-gold';
    return 'text-ink-red';
  };

  const getConfidenceLabel = (confidence?: number) => {
    if (!confidence) return '';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Selected Value Display / Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
          'bg-parchment border border-wood-medium/40 rounded-md',
          'transition-all duration-200',
          'hover:border-wood-medium focus:outline-none focus:ring-2 focus:ring-ink-gold/30',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'ring-2 ring-ink-gold/30 border-wood-medium'
        )}
      >
        {/* Icon */}
        {value ? (
          value.type === 'event' ? (
            <Calendar className="w-4 h-4 text-ink-gold shrink-0" />
          ) : (
            <FolderOpen className="w-4 h-4 text-ink-green shrink-0" />
          )
        ) : (
          <span className="w-4 h-4" />
        )}

        {/* Value Display */}
        <span className={cn('flex-1 truncate', !value && 'text-sepia/60')}>
          {value ? value.name : placeholder}
        </span>

        {/* AI Badge */}
        {aiSuggested && value && (
          <span
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 text-xs rounded',
              'bg-ink-gold/10 border border-ink-gold/30',
              getConfidenceColor(aiConfidence)
            )}
            title={`AI suggested with ${aiConfidence ? Math.round(aiConfidence * 100) : '?'}% confidence`}
          >
            <Sparkles className="w-3 h-3" />
            {aiConfidence && (
              <span className="font-medium">{getConfidenceLabel(aiConfidence)}</span>
            )}
          </span>
        )}

        {/* Clear Button */}
        {value && !disabled && (
          <button
            onClick={handleClear}
            className="p-0.5 text-sepia/60 hover:text-ink-red transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-sepia transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-full mt-1 py-1',
            'bg-parchment-dark border border-wood-medium/40 rounded-md shadow-lg',
            'max-h-64 overflow-hidden'
          )}
        >
          {/* Search Input */}
          <div className="px-2 pb-2 border-b border-wood-medium/20">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'w-full px-2 py-1.5 text-sm',
                'bg-parchment border border-wood-medium/30 rounded',
                'focus:outline-none focus:ring-1 focus:ring-ink-gold/30'
              )}
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-48">
            {/* Events Group */}
            {events.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-sepia/70 uppercase tracking-wider bg-wood-medium/5">
                  Events
                </div>
                {events.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
                      'hover:bg-ink-gold/10 transition-colors',
                      value?.id === option.id && 'bg-ink-gold/15'
                    )}
                  >
                    <Calendar className="w-4 h-4 text-ink-gold shrink-0" />
                    <span className="flex-1 truncate">{option.name}</span>
                    {option.quarter && (
                      <span className="text-xs text-sepia/60">{option.quarter}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Categories Group */}
            {categories.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-xs font-semibold text-sepia/70 uppercase tracking-wider bg-wood-medium/5">
                  Budget Categories
                </div>
                {categories.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
                      'hover:bg-ink-green/10 transition-colors',
                      value?.id === option.id && 'bg-ink-green/15'
                    )}
                  >
                    <FolderOpen className="w-4 h-4 text-ink-green shrink-0" />
                    <span className="flex-1 truncate">{option.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Empty State */}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-sepia/60">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AssignmentSelector;
