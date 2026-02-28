'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', style, ...props }, ref) => {
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const [primaryTextColor, setPrimaryTextColor] = React.useState<'#000000' | '#ffffff'>('#ffffff');

    const getRgbFromCssColor = (color: string): [number, number, number] | null => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

      if (!match) {
        return null;
      }

      return [Number(match[1]), Number(match[2]), Number(match[3])];
    };

    const getContrastingTextColor = ([red, green, blue]: [number, number, number]): '#000000' | '#ffffff' => {
      const normalize = (channel: number) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };

      const luminance = 0.2126 * normalize(red) + 0.7152 * normalize(green) + 0.0722 * normalize(blue);
      const contrastWithWhite = 1.05 / (luminance + 0.05);
      const contrastWithBlack = (luminance + 0.05) / 0.05;

      return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
    };

    React.useEffect(() => {
      if (variant !== 'primary' || !buttonRef.current) {
        return;
      }

      const updatePrimaryTextColor = () => {
        if (!buttonRef.current) {
          return;
        }

        const computedBackground = window.getComputedStyle(buttonRef.current).backgroundColor;
        const rgb = getRgbFromCssColor(computedBackground);

        if (!rgb) {
          return;
        }

        setPrimaryTextColor(getContrastingTextColor(rgb));
      };

      updatePrimaryTextColor();

      const observer = new MutationObserver(updatePrimaryTextColor);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      });

      return () => observer.disconnect();
    }, [variant]);

    const setRefs = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;

      if (typeof ref === 'function') {
        ref(node);
        return;
      }

      if (ref) {
        ref.current = node;
      }
    };

    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
      primary: 'bg-[var(--accent-primary)] hover:opacity-90 focus:ring-[var(--accent-primary)]',
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
        ref={setRefs}
        style={variant === 'primary' ? { color: primaryTextColor, ...style } : style}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
