import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ============================================
   BUTTON COMPONENT
   ============================================
   Victorian-styled buttons with wood tones,
   brass accents, and subtle pressed effects.
   Designed to feel like carved wood or
   embossed leather book covers.
   ============================================ */

const buttonVariants = cva(
  /* Base styles */
  `inline-flex items-center justify-center gap-2 whitespace-nowrap
   font-medium transition-all duration-200
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-gold focus-visible:ring-offset-2 focus-visible:ring-offset-parchment
   disabled:pointer-events-none disabled:opacity-50
   active:scale-[0.98]`,
  {
    variants: {
      variant: {
        /* Primary - Dark mahogany wood */
        primary: `
          bg-gradient-to-b from-wood-dark to-[#2d1a0e]
          text-parchment border border-wood-medium/50
          shadow-md hover:shadow-lg
          hover:from-[#4a2a1a] hover:to-wood-dark
          active:from-[#2d1a0e] active:to-[#1f1108]
        `,

        /* Secondary - Light parchment */
        secondary: `
          bg-gradient-to-b from-parchment to-parchment-dark
          text-wood-dark border border-wood-medium/40
          shadow-sm hover:shadow-md
          hover:from-parchment-dark hover:to-[#ddd5c3]
          active:from-[#ddd5c3] active:to-parchment-dark
        `,

        /* Ghost - Minimal, for nav items */
        ghost: `
          bg-transparent text-wood-dark
          hover:bg-wood-medium/10 hover:text-wood-dark
          active:bg-wood-medium/20
        `,

        /* Outline - Bordered */
        outline: `
          bg-transparent border-2 border-wood-medium
          text-wood-dark
          hover:bg-wood-medium/10
          active:bg-wood-medium/20
        `,

        /* Destructive - Ledger red for danger actions */
        destructive: `
          bg-gradient-to-b from-ink-red to-[#6b1d00]
          text-parchment border border-ink-red/50
          shadow-md hover:shadow-lg
          hover:from-[#9b2d0a] hover:to-ink-red
          active:from-[#6b1d00] active:to-[#4a1400]
        `,

        /* Success - Ledger green for confirmations */
        success: `
          bg-gradient-to-b from-ink-green to-[#123620]
          text-parchment border border-ink-green/50
          shadow-md hover:shadow-lg
          hover:from-[#1f5733] hover:to-ink-green
          active:from-[#123620] active:to-[#0d2617]
        `,

        /* Gold - Accent button for special actions */
        gold: `
          bg-gradient-to-b from-ink-gold to-[#8a6508]
          text-ink-black border border-ink-gold/50
          shadow-md hover:shadow-lg
          hover:from-[#c9970d] hover:to-ink-gold
          active:from-[#8a6508] active:to-[#6b4e06]
        `,

        /* Link - Text-only link style */
        link: `
          bg-transparent text-ink-gold underline-offset-4
          hover:underline hover:text-wood-dark
          p-0 h-auto
        `,
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded',
        md: 'h-10 px-4 text-sm rounded-md',
        lg: 'h-12 px-6 text-base rounded-md',
        xl: 'h-14 px-8 text-lg rounded-lg',
        icon: 'h-10 w-10 rounded-md',
        'icon-sm': 'h-8 w-8 rounded',
        'icon-lg': 'h-12 w-12 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
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
    ref
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
  }
);
Button.displayName = 'Button';

/* Loading Spinner */
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
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
export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon'> {
  icon: React.ReactNode;
  'aria-label': string;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'icon', ...props }, ref) => {
    return (
      <Button ref={ref} size={size} {...props}>
        {icon}
      </Button>
    );
  }
);
IconButton.displayName = 'IconButton';

/* Button Group - For grouped actions */
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

function ButtonGroup({ children, className }: ButtonGroupProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-md shadow-sm',
        '[&>button]:rounded-none',
        '[&>button:first-child]:rounded-l-md',
        '[&>button:last-child]:rounded-r-md',
        '[&>button:not(:first-child)]:-ml-px',
        className
      )}
    >
      {children}
    </div>
  );
}

export { Button, IconButton, ButtonGroup, buttonVariants };
