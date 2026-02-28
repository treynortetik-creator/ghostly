"use client";

import { useState } from "react";
import { Type, RotateCcw, AlertCircle, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/* ============================================
   PROMPT EDITOR COMPONENT
   ============================================
   Textarea editor for customizing AI prompts.
   Supports default/custom states with reset
   functionality and character counting.
   Ghostly theme: "The Scrivener's Desk"
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
    <Card data-oid="mvvc1m3">
      <CardHeader divider={false} className="pb-2" data-oid="7a9.6vk">
        <div className="flex items-center justify-between" data-oid="fty5x12">
          <CardTitle
            className="text-lg flex items-center gap-2"
            data-oid="z9irpbo"
          >
            <Type className="w-5 h-5 text-spectral" data-oid="j5uhsij" />
            {label}
          </CardTitle>

          {/* Custom / Default Badge */}
          {isCustom ? (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-spectral/10 text-spectral border border-spectral"
              data-oid="s3vdu5n"
            >
              Custom
            </span>
          ) : (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-spectral/10 text-muted-foreground border border-border"
              data-oid="ygloen5"
            >
              Default
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1" data-oid="5il0tgr">
          {description}
        </p>
      </CardHeader>

      <CardContent data-oid="tu8:bd-">
        {/* Textarea */}
        <textarea
          value={displayValue}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder={defaultValue}
          className={`
            w-full min-h-[200px] px-4 py-3
            bg-background border border-border rounded-md
            font-mono text-sm leading-relaxed
            transition-all duration-200
            focus:outline-none focus:ring-1 focus:ring-spectral focus:border-spectral
            resize-y
            ${
              disabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:border-border"
            }
            ${isCustom ? "text-foreground" : "text-muted-foreground/60"}
          `}
          data-oid="6v.-y:h"
        />

        {/* Footer: char count + reset button */}
        <div
          className="mt-2 flex items-center justify-between"
          data-oid="9b.xmuq"
        >
          {/* Character Count */}
          <span
            className="text-xs text-muted-foreground/60 tabular-nums"
            data-oid="fikd0zc"
          >
            {charCount.toLocaleString()} characters
          </span>

          {/* Reset to Default */}
          {isCustom && !disabled && (
            <div className="flex items-center gap-2" data-oid="37vuusf">
              {showResetConfirm ? (
                <>
                  <span
                    className="text-xs text-destructive flex items-center gap-1"
                    data-oid="h9ep5lu"
                  >
                    <AlertCircle className="w-3 h-3" data-oid="ncbwj3k" />
                    Are you sure?
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReset}
                    data-oid="0:eqent"
                  >
                    <Check className="w-3 h-3" data-oid="ug5gk5n" />
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResetConfirm(false)}
                    data-oid="yk2muku"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  className="text-muted-foreground hover:text-foreground"
                  data-oid="jvhf-11"
                >
                  <RotateCcw className="w-3.5 h-3.5" data-oid="fu7f.nz" />
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
