export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'event-ticketing.theme';

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function applyTheme(preference: ThemePreference, systemDark: boolean) {
  document.documentElement.dataset.theme = resolveTheme(preference, systemDark);
}

export function initializeTheme() {
  applyTheme(readThemePreference(), window.matchMedia('(prefers-color-scheme: dark)').matches);
}
