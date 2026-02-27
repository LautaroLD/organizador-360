'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

const getRgbFromColor = (color: string): [number, number, number] | null => {
  const value = color.trim();

  if (value.startsWith('#')) {
    const hex = value.slice(1);

    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }

    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
  }

  const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

  if (!rgbMatch) {
    return null;
  }

  return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
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

export function ThemeProvider({ children }: { children: React.ReactNode; }) {
  const { theme, customColors } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    if (theme === 'light' && customColors.light) {
      root.style.setProperty('--accent-primary', customColors.light);
    } else if (theme === 'dark' && customColors.dark) {
      root.style.setProperty('--accent-primary', customColors.dark);
    } else {
      root.style.removeProperty('--accent-primary');
    }

    const accentPrimary = getComputedStyle(root).getPropertyValue('--accent-primary').trim();
    const rgb = getRgbFromColor(accentPrimary);
    const contrastColor = rgb ? getContrastingTextColor(rgb) : '#ffffff';
    root.style.setProperty('--accent-primary-contrast', contrastColor);
  }, [theme, customColors]);

  return <>{children}</>;
}
