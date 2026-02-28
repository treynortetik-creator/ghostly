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
       
      >
        <CardContent className="py-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  trend ? trendColors[trend] : "text-foreground",
                )}
               
              >
                {value}
              </p>
              {subtitle && (
                <p
                  className={cn(
                    "text-xs",
                    trend ? trendColors[trend] : "text-muted-foreground/70",
                  )}
                 
                >
                  {subtitle}
                </p>
              )}
            </div>
            {icon && (
              <div
                className="p-2 rounded-lg bg-spectral/10 text-spectral"
               
              >
                {icon}
              </div>
            )}
          </div>
        </CardContent>
        {/* Decorative corner accent */}
        <div
          className="absolute top-0 right-0 w-16 h-16 overflow-hidden"
         
        >
          <div
            className="absolute -top-8 -right-8 w-16 h-16 bg-gradient-to-br from-spectral/5 to-transparent rotate-45"
           
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
