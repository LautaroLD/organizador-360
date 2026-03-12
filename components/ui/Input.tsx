import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, type, ...props }, ref) => {
    return (
      <div className='w-full'>
        {label && (
          <label className='mb-1 block text-sm font-medium text-[var(--text-primary)]'>
            {label}
          </label>
        )}
        <div className='relative'>
          {icon && (
            <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]'>
              {icon}
            </span>
          )}
          <InputPrimitive
            ref={ref}
            type={type}
            data-slot='input'
            className={cn(
              'flex h-10 w-full rounded-lg border border-[var(--text-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-10',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className='mt-1 text-sm text-red-500'>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
