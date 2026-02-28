import { forwardRef, ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ============================================
   BUTTON COMPONENT
   ============================================
   Ghostly ethereal buttons with glass-morphism
   and spectral glow.
   ============================================ */

const buttonVariants = cva(
  /* Base styles */
  `inline-flex items-center justify-center gap-2 whitespace-nowrap
   font-medium transition-all duration-200
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spectral focus-visible:ring-offset-2 focus-visible:ring-offset-background
   disabled:pointer-events-none disabled:opacity-50
   active:scale-[0.98]`,
  {
    variants: {
      variant: {
        /* Primary - Spectral purple gradient */
        primary: `
          bg-gradient-to-b from-spectral to-spectral/80
          text-primary-foreground border border-spectral/50
          shadow-md hover:shadow-lg hover:shadow-spectral/20
          hover:from-spectral-light hover:to-spectral
          active:from-spectral/70 active:to-spectral/60
          dark:from-spectral dark:to-spectral/80
          dark:text-primary-foreground dark:border-spectral/30
          dark:hover:from-spectral-light dark:hover:to-spectral
          dark:active:from-spectral/70 dark:active:to-spectral/60
        `,

        /* Secondary - Glass-morphism */
        secondary: `
          bg-secondary/80 backdrop-blur-sm
          text-secondary-foreground border border-border
          shadow-sm hover:shadow-md
          hover:bg-secondary
          active:bg-secondary/60
          dark:bg-ghost-light/80 dark:text-phantom
          dark:border-white/10 dark:backdrop-blur-sm
          dark:hover:bg-ghost-light dark:hover:border-spectral/20
          dark:active:bg-ghost-light/60
        `,

        /* Ghost - Minimal, for nav items */
        ghost: `
          bg-transparent text-foreground
          hover:bg-spectral/10 hover:text-foreground
          active:bg-spectral/15
          dark:text-phantom
          dark:hover:bg-spectral/10 dark:hover:text-phantom
          dark:active:bg-spectral/15
        `,

        /* Outline - Bordered */
        outline: `
          bg-transparent border-2 border-border
          text-foreground
          hover:bg-spectral/10
          active:bg-spectral/15
          dark:border-spectral/30 dark:text-phantom
          dark:hover:bg-spectral/10
          dark:active:bg-spectral/15
        `,

        /* Destructive - Red for danger actions */
        destructive: `
          bg-gradient-to-b from-destructive to-destructive/80
          text-white border border-destructive/50
          shadow-md hover:shadow-lg
          hover:from-red-400 hover:to-destructive
          active:from-destructive/80 active:to-destructive/60
          dark:from-destructive dark:to-destructive/80
          dark:text-white dark:border-destructive/30
          dark:hover:from-red-400 dark:hover:to-destructive
        `,

        /* Success - Emerald for confirmations */
        success: `
          bg-gradient-to-b from-emerald-500 to-emerald-600
          text-white border border-emerald-500/50
          shadow-md hover:shadow-lg hover:shadow-emerald-500/20
          hover:from-emerald-400 hover:to-emerald-500
          active:from-emerald-600 active:to-emerald-700
          dark:from-emerald-600 dark:to-emerald-700
          dark:text-white dark:border-emerald-500/30
          dark:hover:from-emerald-500 dark:hover:to-emerald-600
          dark:hover:shadow-emerald-500/25
          dark:active:from-emerald-700 dark:active:to-emerald-800
        `,

        /* Accent - Spectral to ether gradient for special actions */
        accent: `
          bg-gradient-to-r from-spectral to-ether
          text-white border border-spectral/50
          shadow-md hover:shadow-lg hover:shadow-spectral/20
          hover:from-spectral-light hover:to-ether-light
          active:from-spectral/80 active:to-ether/80
          dark:from-spectral dark:to-ether
          dark:text-white dark:border-spectral/30
          dark:hover:from-spectral-light dark:hover:to-ether-light
          dark:hover:shadow-spectral/25
          dark:active:from-spectral/70 dark:active:to-ether/70
        `,

        /* Link - Text-only link style */
        link: `
          bg-transparent text-spectral underline-offset-4
          hover:underline hover:text-spectral-light
          p-0 h-auto
          dark:text-spectral-light dark:hover:text-spectral-soft
        `,
      },
      size: {
        sm: "h-8 px-3 text-xs rounded",
        md: "h-10 px-4 text-sm rounded-md",
        lg: "h-12 px-6 text-base rounded-md",
        xl: "h-14 px-8 text-lg rounded-lg",
        icon: "h-10 w-10 rounded-md",
        "icon-sm": "h-8 w-8 rounded",
        "icon-lg": "h-12 w-12 rounded-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Show loading spinner */
  isLoading?: boolean;
  /** Icon to display before text */
  leftIcon?: React.ReactNode;
  /** Icon to display after text */
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
       
      >
        {isLoading ? (
          <LoadingSpinner className="w-4 h-4" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);
Button.displayName = "Button";

/* Loading Spinner */
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
     
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
       
      />

      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
       
      />
    </svg>
  );
}

/* Icon Button - Convenience wrapper */
export interface IconButtonProps
  extends Omit<ButtonProps, "leftIcon" | "rightIcon"> {
  icon: React.ReactNode;
  "aria-label": string;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = "icon", ...props }, ref) => {
    return (
      <Button ref={ref} size={size} {...props}>
        {icon}
      </Button>
    );
  },
);
IconButton.displayName = "IconButton";

/* Button Group - For grouped actions */
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

function ButtonGroup({ children, className }: ButtonGroupProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-md shadow-sm",
        "[&>button]:rounded-none",
        "[&>button:first-child]:rounded-l-md",
        "[&>button:last-child]:rounded-r-md",
        "[&>button:not(:first-child)]:-ml-px",
        className,
      )}
     
    >
      {children}
    </div>
  );
}

export { Button, IconButton, ButtonGroup, buttonVariants };
