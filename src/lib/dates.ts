import type { Lang } from './i18n';

// Relative day label for list rows and statement section headers:
// today/yesterday via RelativeTimeFormat, else a short localized date.
export function relativeDate(iso: string, lang: Lang): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days >= 0 && days < 7) {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    return rtf.format(-days, 'day');
  }
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export function timeOfDay(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
