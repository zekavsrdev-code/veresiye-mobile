import { translate, type Lang } from './i18n';

// Relative day label for list rows and statement section headers.
// HAND-ROLLED on purpose: Hermes (RN's JS engine) does not implement
// Intl.RelativeTimeFormat — `new Intl.RelativeTimeFormat(...)` throws
// "undefined cannot be used as a constructor" on device (works on web, which is
// how it slipped through). Intl.DateTimeFormat / NumberFormat ARE supported.
export function relativeDate(iso: string, lang: Lang): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) return translate(lang, 'date_today');
  if (days === 1) return translate(lang, 'date_yesterday');
  if (days > 1 && days < 7) return translate(lang, 'date_days_ago').replace('{n}', String(days));

  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export function timeOfDay(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
