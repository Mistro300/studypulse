import { createContext, useContext } from 'react';
import type { ThemeMode } from '@studypulse/shared';

export const THEME_STORAGE_KEY = 'studypulse.theme';
export const SURFACE_BASE_LIGHT = '#FAF9F6';
export const SURFACE_BASE_DARK = '#0D0C12';

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
