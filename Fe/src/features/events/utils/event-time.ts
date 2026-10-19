/** Public schedules use the same business timezone as checkout. */
export function formatEventDate(startsAt: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(startsAt));
}
