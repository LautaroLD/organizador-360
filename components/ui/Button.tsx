import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
      primary: 'bg-[var(--accent-primary)] text-white hover:opacity-90 focus:ring-[var(--accent-primary)]',
      secondary: 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--text-secondary)] hover:bg-opacity-80',
      success: 'bg-[var(--accent-success)] text-white hover:opacity-90 focus:ring-[var(--accent-success)]',
      danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
      ghost: 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]',
    };

    const sizes = {
      sm: 'text-sm p-1',
      md: 'text-base px-2 py-1',
      lg: 'text-lg px-3 py-1.5',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className, 'cursor-pointer')}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
