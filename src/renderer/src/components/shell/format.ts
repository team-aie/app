import type { TFunction } from 'i18next';

/** Compact localized relative time ("5 min ago") using the common namespace. */
export function formatRelativeTime(
  iso: string,
  t: TFunction<'common'>,
  now: number = Date.now()
): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  const diffMinutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (diffMinutes < 1) {
    return t('time.justNow');
  }
  if (diffMinutes < 60) {
    return t('time.minutesAgo', { count: diffMinutes });
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return t('time.hoursAgo', { count: diffHours });
  }
  return t('time.daysAgo', { count: Math.floor(diffHours / 24) });
}

export function percent(recorded: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((Math.min(recorded, total) / total) * 100);
}
