export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'event-ticketing.theme';
let preference: ThemePreference = 'system';
const listeners = new Set<() => void>();

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
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
  const resolved = resolveTheme(preference, systemDark);
  document.documentElement.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0b0d14' : '#eef2f5');
}

export function initializeTheme() {
  preference = readThemePreference();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    applyTheme(preference, media.matches);
    for (const listener of listeners) listener();
  };
  update();
  media.addEventListener('change', update);
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      preference = parseThemePreference(event.newValue);
      update();
    }
  });
}

export function getThemePreference() {
  return preference;
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setThemePreference(value: ThemePreference) {
  preference = value;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // The choice still applies when storage is unavailable.
  }
  applyTheme(value, window.matchMedia('(prefers-color-scheme: dark)').matches);
  for (const listener of listeners) listener();
}
