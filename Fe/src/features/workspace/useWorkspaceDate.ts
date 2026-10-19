import { useLocale } from '../../shared/i18n/LocaleContext';

export function useWorkspaceDate() {
  const { locale } = useLocale();
  return (value: string, timezone?: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date(value));
}
