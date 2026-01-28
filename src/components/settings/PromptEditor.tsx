'use client';

import { useState } from 'react';
import { Type, RotateCcw, AlertCircle, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/* ============================================
   PROMPT EDITOR COMPONENT
   ============================================
   Textarea editor for customizing AI prompts.
   Supports default/custom states with reset
   functionality and character counting.
   Victorian theme: "The Scrivener's Desk"
   ============================================ */

interface PromptEditorProps {
  /** Label displayed in the card header */
  label: string;
  /** Description text shown below the label */
  description: string;
  /** Current prompt value; null means using default */
  value: string | null;
  /** The hardcoded default prompt text */
  defaultValue: string;
  /** Callback when the prompt changes; null resets to default */
  onChange: (value: string | null) => void;
  /** Disable editing */
  disabled?: boolean;
}

export function PromptEditor({
  label,
  description,
  value,
  defaultValue,
  onChange,
  disabled = false,
}: PromptEditorProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isCustom = value !== null;
  const displayValue = isCustom ? value : defaultValue;
  const charCount = displayValue.length;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleReset = () => {
    onChange(null);
    setShowResetConfirm(false);
  };

  return (
    <Card>
      <CardHeader divider={false} className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Type className="w-5 h-5 text-ink-gold" />
            {label}
          </CardTitle>

          {/* Custom / Default Badge */}
          {isCustom ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-ink-gold/15 text-ink-gold border border-ink-gold/30">
              Custom
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-wood-medium/10 text-sepia border border-wood-medium/20">
              Default
            </span>
          )}
        </div>
        <p className="text-sm text-sepia mt-1">
          {description}
        </p>
      </CardHeader>

      <CardContent>
        {/* Textarea */}
        <textarea
          value={displayValue}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder={defaultValue}
          className={`
            w-full min-h-[200px] px-4 py-3
            bg-parchment border border-wood-medium/40 rounded-md
            font-mono text-sm leading-relaxed
            transition-all duration-200
            focus:outline-none focus:ring-1 focus:ring-ink-gold focus:border-ink-gold
            resize-y
            ${disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:border-wood-medium'
            }
            ${isCustom
              ? 'text-wood-dark'
              : 'text-sepia/70'
            }
          `}
        />

        {/* Footer: char count + reset button */}
        <div className="mt-2 flex items-center justify-between">
          {/* Character Count */}
          <span className="text-xs text-sepia/70 tabular-nums">
            {charCount.toLocaleString()} characters
          </span>

          {/* Reset to Default */}
          {isCustom && !disabled && (
            <div className="flex items-center gap-2">
              {showResetConfirm ? (
                <>
                  <span className="text-xs text-ink-red flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Are you sure?
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReset}
                  >
                    <Check className="w-3 h-3" />
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  className="text-sepia hover:text-wood-dark"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Default
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PromptEditor;
