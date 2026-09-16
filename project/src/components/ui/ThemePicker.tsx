import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, parseThemePreference, readThemePreference, THEME_STORAGE_KEY } from '@/theme/theme';

export function ThemePicker() {
  const [preference, setPreference] = useState(readThemePreference);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(preference, media.matches);
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreference(parseThemePreference(event.newValue));
    };
    update();
    media.addEventListener('change', update);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', sync);
    };
  }, [preference]);

  const Icon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor;

  return (
    <label className="theme-picker">
      <Icon size={14} aria-hidden="true" />
      <span className="sr-only">Giao diện</span>
      <select
        value={preference}
        aria-label="Chọn giao diện"
        onChange={(event) => {
          const next = parseThemePreference(event.target.value);
          setPreference(next);
          try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
          } catch {
            applyTheme(next, window.matchMedia('(prefers-color-scheme: dark)').matches);
          }
        }}
      >
        <option value="light">Biển xanh</option>
        <option value="dark">Vũ trụ</option>
        <option value="system">Hệ thống</option>
      </select>
    </label>
  );
}
