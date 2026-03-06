"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, ProgressBar } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { DollarSign, TrendingDown, TrendingUp, Wallet, Pencil } from "lucide-react";

/* ============================================
   BUDGET OVERVIEW CARD
   ============================================
   Displays total budget, actual spending, and remaining
   with Ghostly-themed presentation and progress bar.
   Budget is inline-editable — click to change.
   ============================================ */

export interface BudgetOverviewCardProps {
  budget: number;
  allocated?: number;
  actual: number;
  remaining: number;
  className?: string;
  onBudgetChange?: (newBudget: number) => void;
}

export function BudgetOverviewCard({
  budget,
  allocated,
  actual,
  remaining,
  className,
  onBudgetChange,
}: BudgetOverviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    setEditValue(budget.toString());
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const saveBudget = async () => {
    const newBudget = parseFloat(editValue) || 0;
    if (newBudget === budget) {
      cancelEditing();
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();

      const putRes = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscal_year_id: data.settings.fiscal_year_id,
          openrouter_model: data.settings.openrouter_model,
          total_budget: newBudget,
        }),
      });

      if (!putRes.ok) throw new Error("Failed to save budget");

      onBudgetChange?.(newBudget);
      setIsEditing(false);
    } catch {
      // Revert on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveBudget();
    if (e.key === "Escape") cancelEditing();
  };

  const hasSetBudget = allocated !== undefined && allocated !== budget;
  const percentUsed = budget > 0 ? (actual / budget) * 100 : 0;
  const isOverBudget = actual > budget;

  const getStatusColor = () => {
    if (isOverBudget) return "text-destructive";
    if (percentUsed >= 80) return "text-spectral";
    return "text-emerald-400";
  };

  const getStatusText = () => {
    if (isOverBudget) return "Over Budget";
    if (percentUsed >= 80) return "Nearing Limit";
    return "On Track";
  };

  return (
    <Card className={className} glow elevated>
      <CardContent className="py-6">
        {/* Header */}
        <div
          className="flex items-center justify-between mb-6"
         
        >
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-lg bg-spectral/10 text-muted-foreground"
             
            >
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2
                className="text-2xl font-semibold text-foreground"
               
              >
                Annual Budget
              </h2>
              <p className="text-sm text-muted-foreground">
                FY {new Date().getFullYear()} Overview
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-1.5 text-sm font-medium ${getStatusColor()}`}
           
          >
            {isOverBudget ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )}
            <span>{getStatusText()}</span>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Total Budget — inline editable */}
          <div
            className="text-center border-r border-border pr-6"
          >
            <div
              className="flex items-center justify-center gap-2 text-muted-foreground mb-1"
            >
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">
                Total Budget
              </span>
            </div>
            {isEditing ? (
              <div className="inline-flex flex-col items-center gap-2">
                <div className="relative inline-flex items-center">
                  <span className="absolute left-2 text-xl font-bold text-spectral">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                      const parts = cleaned.split(".");
                      setEditValue(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    className="w-48 pl-7 pr-3 py-1 text-3xl font-bold text-foreground tabular-nums bg-background border border-spectral rounded-md focus:outline-none focus:ring-2 focus:ring-spectral/50 text-center"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveBudget}
                    disabled={isSaving}
                    className="px-3 py-1 text-xs font-medium bg-spectral text-white rounded-md hover:bg-spectral-light transition-colors disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={isSaving}
                    className="px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={startEditing}
                className="group inline-flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                title="Click to edit budget"
              >
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {formatCurrency(budget)}
                </p>
                <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>

          {/* Actual Spent */}
          <div
            className="text-center border-r border-border pr-6"
           
          >
            <div
              className="flex items-center justify-center gap-2 text-muted-foreground mb-1"
             
            >
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">
                Spent to Date
              </span>
            </div>
            <p
              className={`text-3xl font-bold tabular-nums ${isOverBudget ? "text-destructive" : "text-foreground"}`}
             
            >
              {formatCurrency(actual)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {percentUsed.toFixed(1)}% of budget
            </p>
          </div>

          {/* Remaining */}
          <div className="text-center">
            <div
              className="flex items-center justify-center gap-2 text-muted-foreground mb-1"
             
            >
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">
                Remaining
              </span>
            </div>
            <p
              className={`text-3xl font-bold tabular-nums ${getStatusColor()}`}
             
            >
              {formatCurrency(remaining)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(100 - percentUsed).toFixed(1)}% available
            </p>
          </div>
        </div>

        {/* Allocated indicator (when a total budget is set) */}
        {hasSetBudget && allocated !== undefined && (
          <div
            className="flex items-center justify-between text-sm px-1 mb-4"
           
          >
            <span className="text-muted-foreground">
              Allocated to events &amp; categories
            </span>
            <span
              className={
                allocated > budget
                  ? "text-destructive font-medium"
                  : "text-foreground font-medium"
              }
             
            >
              {formatCurrency(allocated)} of {formatCurrency(budget)}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="pt-4 border-t border-border">
          <ProgressBar
            value={actual}
            max={budget}
            size="lg"
            showLabel
            labelFormat="both"
            animated={isOverBudget}
           
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default BudgetOverviewCard;
