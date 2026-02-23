'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

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
  }, [theme, customColors]);

  return <>{children}</>;
}
