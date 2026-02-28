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
              data-oid="kp42u.r"
            >
              {percentage.toFixed(0)}%
            </span>
          );

        case "amount":
          return (
            <span
              className="text-sm font-medium tabular-nums"
              data-oid="v0wzx1q"
            >
              {formatValue(value)} / {formatValue(max)}
            </span>
          );

        case "both":
          return (
            <div
              className="flex items-center justify-between text-sm"
              data-oid="xe:3xoo"
            >
              <span className="font-medium tabular-nums" data-oid="j5i51u6">
                {formatValue(value)} / {formatValue(max)}
              </span>
              <span className="text-muted-foreground tabular-nums" data-oid="ys-y3yr">
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
        data-oid="r5ozeij"
      >
        {showLabel && labelFormat === "both" && (
          <div className="mb-1.5" data-oid="kzeyr:e">
            {renderLabel()}
          </div>
        )}

        <div className="flex items-center gap-3" data-oid="acj7kh.">
          {/* Progress track */}
          <div
            className={cn(
              "flex-1 rounded-full overflow-hidden",
              getTrackColor(),
              sizeClasses[size],
            )}
            data-oid="1nlsdrp"
          >
            {/* Progress fill */}
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                getColor(),
                animated && isOverBudget && "animate-pulse",
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
              data-oid="tow.ipy"
            />
          </div>

          {/* Side label for percentage or amount (not both) */}
          {showLabel && labelFormat !== "both" && renderLabel()}
        </div>

        {/* Over budget indicator */}
        {isOverBudget && (
          <div
            className="mt-1.5 flex items-center gap-1.5 text-red-400 text-xs font-medium"
            data-oid="a5w4z8d"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"
              data-oid="-6tgk_f"
            />

            <span data-oid="4hlk.w4">
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
        data-oid="93ecm7s"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between mb-3"
          data-oid="t3d8x_z"
        >
          <div className="flex items-center gap-2" data-oid="k7lks:x">
            {icon && (
              <span className="text-spectral" data-oid="oefuwir">
                {icon}
              </span>
            )}
            <span className="font-medium text-foreground" data-oid="v1unod.">
              {label}
            </span>
          </div>
          <span
            className={cn("text-xs font-medium", getStatusColor())}
            data-oid="43p8kdn"
          >
            {getStatusText()}
          </span>
        </div>

        {/* Progress Bar */}
        <ProgressBar value={spent} max={budget} size="md" data-oid="is7hz78" />

        {/* Stats */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs" data-oid="6q2pj:6">
          <div data-oid="pf:k-:p">
            <span className="text-muted-foreground block" data-oid="bvg-4eb">
              Spent
            </span>
            <span
              className="font-medium tabular-nums text-foreground"
              data-oid="9ho92fi"
            >
              {formatCurrency(spent)}
            </span>
          </div>
          <div className="text-center" data-oid=":pj0myx">
            <span className="text-muted-foreground block" data-oid="rkh4ma.">
              Budget
            </span>
            <span
              className="font-medium tabular-nums text-foreground"
              data-oid="rn0p1:2"
            >
              {formatCurrency(budget)}
            </span>
          </div>
          <div className="text-right" data-oid="pz9qg4k">
            <span className="text-muted-foreground block" data-oid="xmkdt4x">
              Remaining
            </span>
            <span
              className={cn("font-medium tabular-nums", getStatusColor())}
              data-oid="bzj.pmn"
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
        data-oid="-kwpp3m"
      >
        {label && (
          <span
            className="text-xs text-muted-foreground whitespace-nowrap"
            data-oid="kcxo2dh"
          >
            {label}
          </span>
        )}
        <div
          className="w-16 h-1.5 rounded-full bg-muted overflow-hidden"
          data-oid="6or3n-j"
        >
          <div
            className={cn("h-full rounded-full transition-all", getColor())}
            style={{ width: `${Math.min(percentage, 100)}%` }}
            data-oid=".6dr2mj"
          />
        </div>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            isOverBudget ? "text-red-400" : "text-muted-foreground",
          )}
          data-oid="zs9308i"
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
    );
  },
);
MiniProgress.displayName = "MiniProgress";

export { ProgressBar, BudgetProgress, MiniProgress };
