import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

/* ============================================
   PROGRESS BAR COMPONENT
   ============================================
   Ghostly progress bar with spectral glow.
   Uses status colors:
   - Green: Under 80% of budget (healthy)
   - Yellow/Gold: 80-100% of budget (caution)
   - Red: Over budget (alert)
   ============================================ */

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Current value */
  value: number;
  /** Maximum value (budget) */
  max: number;
  /** Show percentage or amount labels */
  showLabel?: boolean;
  /** Format for the label */
  labelFormat?: "percentage" | "amount" | "both";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show animated stripes when over budget */
  animated?: boolean;
  /** Custom color override (bypasses automatic color) */
  colorOverride?: "green" | "gold" | "red";
}

const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      className,
      value,
      max,
      showLabel = false,
      labelFormat = "percentage",
      size = "md",
      animated = false,
      colorOverride,
      ...props
    },
    ref,
  ) => {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const isOverBudget = value > max;
    const overflowPercentage = isOverBudget ? ((value - max) / max) * 100 : 0;

    // Determine color based on percentage
    const getColor = () => {
      if (colorOverride) {
        return {
          green: "bg-emerald-400",
          gold: "bg-amber-400",
          red: "bg-red-400",
        }[colorOverride];
      }

      if (isOverBudget) return "bg-red-400";
      if (percentage >= 80) return "bg-amber-400";
      return "bg-emerald-400";
    };

    const getTrackColor = () => {
      if (colorOverride) {
        return {
          green: "bg-emerald-400/15",
          gold: "bg-amber-400/15",
          red: "bg-red-400/15",
        }[colorOverride];
      }

      if (isOverBudget) return "bg-red-400/15";
      if (percentage >= 80) return "bg-amber-400/15";
      return "bg-emerald-400/15";
    };

    const sizeClasses = {
      sm: "h-1.5",
      md: "h-2.5",
      lg: "h-4",
    };

    const formatValue = (val: number) => formatCurrency(val);

    const renderLabel = () => {
      if (!showLabel) return null;

      switch (labelFormat) {
        case "percentage":
          return (
            <span
              className="text-sm font-medium tabular-nums"
             
            >
              {percentage.toFixed(0)}%
            </span>
          );

        case "amount":
          return (
            <span
              className="text-sm font-medium tabular-nums"
             
            >
              {formatValue(value)} / {formatValue(max)}
            </span>
          );

        case "both":
          return (
            <div
              className="flex items-center justify-between text-sm"
             
            >
              <span className="font-medium tabular-nums">
                {formatValue(value)} / {formatValue(max)}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div
        ref={ref}
        className={cn("w-full", className)}
        {...props}
       
      >
        {showLabel && labelFormat === "both" && (
          <div className="mb-1.5">
            {renderLabel()}
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Progress track */}
          <div
            className={cn(
              "flex-1 rounded-full overflow-hidden",
              getTrackColor(),
              sizeClasses[size],
            )}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={showLabel ? undefined : "Progress"}
          >
            {/* Progress fill */}
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                getColor(),
                animated && isOverBudget && "animate-pulse",
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
             
            />
          </div>

          {/* Side label for percentage or amount (not both) */}
          {showLabel && labelFormat !== "both" && renderLabel()}
        </div>

        {/* Over budget indicator */}
        {isOverBudget && (
          <div
            className="mt-1.5 flex items-center gap-1.5 text-red-400 text-xs font-medium"
           
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"
             
            />

            <span>
              Over by {formatValue(value - max)} (
              {overflowPercentage.toFixed(0)}%)
            </span>
          </div>
        )}
      </div>
    );
  },
);
ProgressBar.displayName = "ProgressBar";

/* Budget Progress Card - Complete budget visualization */
export interface BudgetProgressProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  spent: number;
  budget: number;
  /** Optional icon */
  icon?: React.ReactNode;
}

const BudgetProgress = forwardRef<HTMLDivElement, BudgetProgressProps>(
  ({ className, label, spent, budget, icon, ...props }, ref) => {
    const remaining = budget - spent;
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;

    const getStatusColor = () => {
      if (remaining < 0) return "text-red-400";
      if (percentage >= 80) return "text-amber-400";
      return "text-emerald-400";
    };

    const getStatusText = () => {
      if (remaining < 0) return "Over Budget";
      if (percentage >= 80) return "Nearing Budget";
      return "On Track";
    };

    return (
      <div
        ref={ref}
        className={cn(
          "p-4 rounded-lg bg-card border border-border",
          className,
        )}
        {...props}
       
      >
        {/* Header */}
        <div
          className="flex items-center justify-between mb-3"
         
        >
          <div className="flex items-center gap-2">
            {icon && (
              <span className="text-spectral">
                {icon}
              </span>
            )}
            <span className="font-medium text-foreground">
              {label}
            </span>
          </div>
          <span
            className={cn("text-xs font-medium", getStatusColor())}
           
          >
            {getStatusText()}
          </span>
        </div>

        {/* Progress Bar */}
        <ProgressBar value={spent} max={budget} size="md" />

        {/* Stats */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground block">
              Spent
            </span>
            <span
              className="font-medium tabular-nums text-foreground"
             
            >
              {formatCurrency(spent)}
            </span>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground block">
              Budget
            </span>
            <span
              className="font-medium tabular-nums text-foreground"
             
            >
              {formatCurrency(budget)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground block">
              Remaining
            </span>
            <span
              className={cn("font-medium tabular-nums", getStatusColor())}
             
            >
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
      </div>
    );
  },
);
BudgetProgress.displayName = "BudgetProgress";

/* Mini Progress - Compact inline progress */
export interface MiniProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  label?: string;
}

const MiniProgress = forwardRef<HTMLDivElement, MiniProgressProps>(
  ({ className, value, max, label, ...props }, ref) => {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const isOverBudget = value > max;

    const getColor = () => {
      if (isOverBudget) return "bg-red-400";
      if (percentage >= 80) return "bg-amber-400";
      return "bg-emerald-400";
    };

    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center gap-2", className)}
        {...props}
       
      >
        {label && (
          <span
            className="text-xs text-muted-foreground whitespace-nowrap"
           
          >
            {label}
          </span>
        )}
        <div
          className="w-16 h-1.5 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label || "Progress"}
        >
          <div
            className={cn("h-full rounded-full transition-all", getColor())}
            style={{ width: `${Math.min(percentage, 100)}%` }}
           
          />
        </div>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            isOverBudget ? "text-red-400" : "text-muted-foreground",
          )}
         
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
    );
  },
);
MiniProgress.displayName = "MiniProgress";

export { ProgressBar, BudgetProgress, MiniProgress };
