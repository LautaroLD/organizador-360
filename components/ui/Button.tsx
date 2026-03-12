'use client';

import * as React from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] hover:opacity-90 focus:ring-[var(--accent-primary)]',
        secondary:
          'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--text-secondary)] hover:bg-opacity-80',
        success:
          'bg-[var(--accent-success)] text-white hover:opacity-90 focus:ring-[var(--accent-success)]',
        danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
        ghost: 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]',
        default:
          'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] hover:opacity-90 focus:ring-[var(--accent-primary)]',
        outline:
          'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]',
        destructive: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
        link: 'text-[var(--accent-primary)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'text-sm p-1',
        md: 'text-base px-2 py-1',
        lg: 'text-lg px-3 py-1.5',
        default: 'text-base px-2 py-1',
        xs: 'text-xs p-1',
        icon: 'h-8 w-8 p-0',
        'icon-xs': 'h-6 w-6 p-0',
        'icon-sm': 'h-7 w-7 p-0',
        'icon-lg': 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    style?: React.CSSProperties;
  };

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
