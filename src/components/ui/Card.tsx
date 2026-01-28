import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* ============================================
   CARD COMPONENT
   ============================================
   Victorian-styled card with parchment background,
   wood-tone borders, and stacked paper shadow effect.
   ============================================ */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Add decorative corner flourishes */
  flourish?: boolean;
  /** Elevated shadow for emphasis */
  elevated?: boolean;
  /** Add subtle ledger lines to the background */
  ledgerLines?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, flourish, elevated, ledgerLines, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-parchment-dark rounded-lg border border-wood-medium/40',
          'transition-all duration-200',
          elevated ? 'parchment-shadow hover:shadow-lg' : 'parchment-shadow',
          flourish && 'corner-flourish',
          ledgerLines && 'ledger-lines',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

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
          'px-6 py-4',
          divider && 'border-b border-wood-medium/20',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

/* Card Title */
const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn(
          'font-serif text-xl font-semibold text-wood-dark tracking-tight',
          className
        )}
        {...props}
      >
        {children}
      </h3>
    );
  }
);
CardTitle.displayName = 'CardTitle';

/* Card Description */
const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(
          'text-sm text-sepia mt-1',
          className
        )}
        {...props}
      >
        {children}
      </p>
    );
  }
);
CardDescription.displayName = 'CardDescription';

/* Card Content */
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-6 py-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardContent.displayName = 'CardContent';

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
          'px-6 py-4',
          divider && 'border-t border-wood-medium/20',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardFooter.displayName = 'CardFooter';

/* Stat Card - For dashboard metrics */
export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, subtitle, trend, icon, ...props }, ref) => {
    const trendColors = {
      positive: 'text-ink-green',
      negative: 'text-ink-red',
      neutral: 'text-sepia',
    };

    return (
      <Card
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        {...props}
      >
        <CardContent className="py-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-sepia">{title}</p>
              <p className={cn(
                'text-2xl font-serif font-bold tabular-nums',
                trend ? trendColors[trend] : 'text-ink-black'
              )}>
                {value}
              </p>
              {subtitle && (
                <p className={cn(
                  'text-xs',
                  trend ? trendColors[trend] : 'text-sepia/70'
                )}>
                  {subtitle}
                </p>
              )}
            </div>
            {icon && (
              <div className="p-2 rounded-lg bg-wood-medium/10 text-wood-medium">
                {icon}
              </div>
            )}
          </div>
        </CardContent>
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
          <div className="absolute -top-8 -right-8 w-16 h-16 bg-gradient-to-br from-ink-gold/5 to-transparent rotate-45" />
        </div>
      </Card>
    );
  }
);
StatCard.displayName = 'StatCard';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, StatCard };
