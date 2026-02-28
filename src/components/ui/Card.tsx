import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ============================================
   CARD COMPONENT
   ============================================
   Ghostly glass-morphism card with ethereal
   borders and spectral glow effects.
   ============================================ */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Add spectral glow effect */
  glow?: boolean;
  /** Elevated shadow for emphasis */
  elevated?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow, elevated, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-card rounded-xl border border-border",
          "transition-all duration-200",
          elevated ? "glass-shadow hover:shadow-lg" : "glass-shadow",
          glow && "glass-glow-sm",
          className,
        )}
        {...props}
        data-oid="mtu.tl9"
      >
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";

/* Card Header */
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Add decorative bottom border */
  divider?: boolean;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, divider = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "px-6 py-4",
          divider && "border-b border-border",
          className,
        )}
        {...props}
        data-oid="83fp9:8"
      >
        {children}
      </div>
    );
  },
);
CardHeader.displayName = "CardHeader";

/* Card Title */
const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn(
        "text-xl font-semibold text-foreground tracking-tight",
        className,
      )}
      {...props}
      data-oid="dbkb137"
    >
      {children}
    </h3>
  );
});
CardTitle.displayName = "CardTitle";

/* Card Description */
const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground mt-1", className)}
      {...props}
      data-oid="l7du_qo"
    >
      {children}
    </p>
  );
});
CardDescription.displayName = "CardDescription";

/* Card Content */
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("px-6 py-4", className)}
        {...props}
        data-oid="072q8gg"
      >
        {children}
      </div>
    );
  },
);
CardContent.displayName = "CardContent";

/* Card Footer */
export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Add decorative top border */
  divider?: boolean;
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, divider = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "px-6 py-4",
          divider && "border-t border-border",
          className,
        )}
        {...props}
        data-oid="6m08_2:"
      >
        {children}
      </div>
    );
  },
);
CardFooter.displayName = "CardFooter";

/* Stat Card - For dashboard metrics */
export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, subtitle, trend, icon, ...props }, ref) => {
    const trendColors = {
      positive: "text-emerald-400",
      negative: "text-red-400",
      neutral: "text-muted-foreground",
    };

    return (
      <Card
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        {...props}
        data-oid="s4bol:q"
      >
        <CardContent className="py-5" data-oid="z4hujv3">
          <div className="flex items-start justify-between" data-oid="-6cx7.c">
            <div className="space-y-1" data-oid="ygvnpn_">
              <p className="text-sm font-medium text-muted-foreground" data-oid="ql49qus">
                {title}
              </p>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  trend ? trendColors[trend] : "text-foreground",
                )}
                data-oid="b9vdz1_"
              >
                {value}
              </p>
              {subtitle && (
                <p
                  className={cn(
                    "text-xs",
                    trend ? trendColors[trend] : "text-muted-foreground/70",
                  )}
                  data-oid="n5r9mgd"
                >
                  {subtitle}
                </p>
              )}
            </div>
            {icon && (
              <div
                className="p-2 rounded-lg bg-spectral/10 text-spectral"
                data-oid="94zsqw3"
              >
                {icon}
              </div>
            )}
          </div>
        </CardContent>
        {/* Decorative corner accent */}
        <div
          className="absolute top-0 right-0 w-16 h-16 overflow-hidden"
          data-oid="etau9uy"
        >
          <div
            className="absolute -top-8 -right-8 w-16 h-16 bg-gradient-to-br from-spectral/5 to-transparent rotate-45"
            data-oid="z5cc2lj"
          />
        </div>
      </Card>
    );
  },
);
StatCard.displayName = "StatCard";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
};
