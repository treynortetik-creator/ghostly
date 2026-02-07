import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ============================================
   PROGRESS BAR COMPONENT
   ============================================
   Victorian-styled progress bar for budget tracking.
   Uses ledger colors:
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
          green: "bg-ink-green",
          gold: "bg-ink-gold",
          red: "bg-ink-red",
        }[colorOverride];
      }

      if (isOverBudget) return "bg-ink-red";
      if (percentage >= 80) return "bg-ink-gold";
      return "bg-ink-green";
    };

    const getTrackColor = () => {
      if (colorOverride) {
        return {
          green: "bg-ink-green/15",
          gold: "bg-ink-gold/15",
          red: "bg-ink-red/15",
        }[colorOverride];
      }

      if (isOverBudget) return "bg-ink-red/15";
      if (percentage >= 80) return "bg-ink-gold/15";
      return "bg-ink-green/15";
    };

    const sizeClasses = {
      sm: "h-1.5",
      md: "h-2.5",
      lg: "h-4",
    };

    const formatValue = (val: number) => {
      return val.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

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
              <span className="text-sepia tabular-nums" data-oid="ys-y3yr">
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
            className="mt-1.5 flex items-center gap-1.5 text-ink-red text-xs font-medium"
            data-oid="a5w4z8d"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-ink-red animate-pulse"
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
      if (remaining < 0) return "text-ink-red";
      if (percentage >= 80) return "text-ink-gold";
      return "text-ink-green";
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
          "p-4 rounded-lg bg-parchment-dark border border-wood-medium/30",
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
              <span className="text-wood-medium" data-oid="oefuwir">
                {icon}
              </span>
            )}
            <span className="font-medium text-ink-black" data-oid="v1unod.">
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
            <span className="text-sepia block" data-oid="bvg-4eb">
              Spent
            </span>
            <span
              className="font-medium tabular-nums text-ink-black"
              data-oid="9ho92fi"
            >
              {spent.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="text-center" data-oid=":pj0myx">
            <span className="text-sepia block" data-oid="rkh4ma.">
              Budget
            </span>
            <span
              className="font-medium tabular-nums text-ink-black"
              data-oid="rn0p1:2"
            >
              {budget.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          <div className="text-right" data-oid="pz9qg4k">
            <span className="text-sepia block" data-oid="xmkdt4x">
              Remaining
            </span>
            <span
              className={cn("font-medium tabular-nums", getStatusColor())}
              data-oid="bzj.pmn"
            >
              {remaining.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
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
      if (isOverBudget) return "bg-ink-red";
      if (percentage >= 80) return "bg-ink-gold";
      return "bg-ink-green";
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
            className="text-xs text-sepia whitespace-nowrap"
            data-oid="kcxo2dh"
          >
            {label}
          </span>
        )}
        <div
          className="w-16 h-1.5 rounded-full bg-wood-medium/20 overflow-hidden"
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
            isOverBudget ? "text-ink-red" : "text-sepia",
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
