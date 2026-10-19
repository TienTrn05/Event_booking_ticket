import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LocaleContext, type Locale } from './LocaleContext';
const storageKey = 'event-ticketing.locale';
function readLocale(): Locale {
  try {
    return localStorage.getItem(storageKey) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(readLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) updateLocale(readLocale());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [locale]);
  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Preference remains in memory. */
    }
  }, []);
  const t = useCallback((vi: string, en: string) => (locale === 'vi' ? vi : en), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
