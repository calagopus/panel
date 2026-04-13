import { getTranslations } from '@/providers/TranslationProvider.tsx';

export function formatMilliseconds(uptime: number, short = true) {
  const uptimeSeconds = Math.floor(uptime / 1000);

  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const formatter = new Intl.DurationFormat(getTranslations().language, {
    style: short ? 'narrow' : 'long',
    secondsDisplay: 'always',
  });

  return formatter.format({ days, hours, minutes, seconds });
}

export function formatDateTime(timestamp: string | number | Date, precise?: boolean, short = true) {
  return new Date(timestamp).toLocaleString(getTranslations().language, {
    year: 'numeric',
    month: short ? 'short' : 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: precise ? 'numeric' : undefined,
    timeZoneName: !short ? 'short' : undefined,
  });
}

export function formatDateTimeAsTimezone(
  timestamp: string | number | Date,
  timezone: string,
  precise?: boolean,
  short = true,
) {
  return new Date(timestamp).toLocaleString(getTranslations().language, {
    year: 'numeric',
    month: short ? 'short' : 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: precise ? 'numeric' : undefined,
    timeZone: timezone,
    timeZoneName: !short ? 'short' : undefined,
  });
}

export function formatTimestamp(timestamp: string | number | Date) {
  const now = new Date();
  const target = new Date(timestamp);

  const diffMs = target.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  const absSeconds = Math.abs(diffSeconds);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffDays) >= 7) {
    return formatDateTime(timestamp);
  }

  const rtf = new Intl.RelativeTimeFormat(getTranslations().language, { numeric: 'auto' });

  if (absSeconds < 60) {
    return rtf.format(diffSeconds, 'second');
  }

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  return rtf.format(diffDays, 'day');
}
