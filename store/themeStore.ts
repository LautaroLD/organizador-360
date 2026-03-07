import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface CustomColors {
  light: string | null;
  dark: string | null;
}

interface ThemeStore {
  theme: Theme;
  customColors: CustomColors;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setCustomColor: (theme: Theme, color: string | null) => void;
  setCustomColors: (customColors: CustomColors) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      customColors: {
        light: null,
        dark: null,
      },
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
      setTheme: (theme) => set({ theme }),
      setCustomColor: (theme, color) =>
        set((state) => ({
          customColors: {
            ...state.customColors,
            [theme]: color,
          },
        })),
      setCustomColors: (customColors) => set({ customColors }),
    }),
    {
      name: 'theme-storage',
      // Persist only the current theme locally. Custom colors now come from DB.
      partialize: (state) => ({ theme: state.theme }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ThemeStore>;

        return {
          ...currentState,
          theme: persisted.theme === 'dark' ? 'dark' : 'light',
        };
      },
    }
  )
);
