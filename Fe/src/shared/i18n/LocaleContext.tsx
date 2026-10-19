import { createContext, useContext } from 'react';

export type Locale = 'vi' | 'en';
export const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (vi: string, en: string) => string;
} | null>(null);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale requires LocaleProvider');
  return context;
}
