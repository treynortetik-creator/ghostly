import { cn } from "@/lib/utils";

/* ============================================
   EMPTY STATE COMPONENT
   ============================================
   Shared component for displaying empty list
   states across the application. Uses the
   ghostly spectral theme.
   ============================================ */

export interface EmptyStateProps {
  /** Icon to display above the title */
  icon: React.ReactNode;
  /** Heading text */
  title: string;
  /** Description text below the title */
  description: string;
  /** Optional CTA button or action element */
  action?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-4",
        className,
      )}
    >
      <div className="text-muted-foreground/40 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
