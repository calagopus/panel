export const CRON_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export type SimpleSchedule =
  | { frequency: 'everyMinutes'; interval: number }
  | { frequency: 'everyHours'; interval: number }
  | { frequency: 'daily'; hour: number; minute: number }
  | { frequency: 'weekly'; weekday: (typeof CRON_WEEKDAYS)[number]; hour: number; minute: number }
  | { frequency: 'monthly'; day: number; hour: number; minute: number };

export function parseSimpleSchedule(schedule: string): SimpleSchedule | null {
  const segments = schedule.trim().split(/\s+/);
  if (segments.length !== 6) return null;

  const [second, minute, hour, dayOfMonth, month, weekday] = segments;
  if (second !== '0' || month !== '*') return null;

  const asNumber = (segment: string) => (/^\d+$/.test(segment) ? Number(segment) : null);
  const asInterval = (segment: string) => {
    if (segment === '*') return 1;
    const match = /^\*\/(\d+)$/.exec(segment);
    return match ? Number(match[1]) : null;
  };

  if (dayOfMonth === '*' && weekday === '*') {
    const minuteInterval = asInterval(minute);
    if (hour === '*' && minuteInterval !== null) return { frequency: 'everyMinutes', interval: minuteInterval };

    const hourInterval = asInterval(hour);
    if (minute === '0' && hourInterval !== null) return { frequency: 'everyHours', interval: hourInterval };

    const parsedHour = asNumber(hour);
    const parsedMinute = asNumber(minute);
    if (parsedHour !== null && parsedMinute !== null) {
      return { frequency: 'daily', hour: parsedHour, minute: parsedMinute };
    }

    return null;
  }

  const parsedHour = asNumber(hour);
  const parsedMinute = asNumber(minute);
  if (parsedHour === null || parsedMinute === null) return null;

  if (dayOfMonth === '*') {
    const namedWeekday = CRON_WEEKDAYS.indexOf(weekday.toUpperCase() as (typeof CRON_WEEKDAYS)[number]);
    const weekdayIndex = namedWeekday !== -1 ? namedWeekday : asNumber(weekday);
    if (weekdayIndex !== null && weekdayIndex >= 0 && weekdayIndex <= 6) {
      return { frequency: 'weekly', weekday: CRON_WEEKDAYS[weekdayIndex], hour: parsedHour, minute: parsedMinute };
    }
  } else if (weekday === '*') {
    const parsedDay = asNumber(dayOfMonth);
    if (parsedDay !== null && parsedDay >= 1 && parsedDay <= 31) {
      return { frequency: 'monthly', day: parsedDay, hour: parsedHour, minute: parsedMinute };
    }
  }

  return null;
}

export function simpleScheduleToCron(schedule: SimpleSchedule): string {
  switch (schedule.frequency) {
    case 'everyMinutes':
      return schedule.interval === 1 ? '0 * * * * *' : `0 */${schedule.interval} * * * *`;
    case 'everyHours':
      return schedule.interval === 1 ? '0 0 * * * *' : `0 0 */${schedule.interval} * * *`;
    case 'daily':
      return `0 ${schedule.minute} ${schedule.hour} * * *`;
    case 'weekly':
      return `0 ${schedule.minute} ${schedule.hour} * * ${schedule.weekday}`;
    case 'monthly':
      return `0 ${schedule.minute} ${schedule.hour} ${schedule.day} * *`;
  }
}

export function getLocalizedCronWeekdays(language: string): { value: (typeof CRON_WEEKDAYS)[number]; label: string }[] {
  const formatter = new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' });

  let firstCronWeekday = 0;
  try {
    const locale = new Intl.Locale(language);
    const weekInfo = locale.getWeekInfo?.() ?? (locale as { weekInfo?: { firstDay: number } }).weekInfo;
    if (weekInfo?.firstDay) firstCronWeekday = weekInfo.firstDay % 7;
  } catch {
    // ignore
  }

  return Array.from({ length: 7 }, (_, offset) => {
    const day = (firstCronWeekday + offset) % 7;
    return {
      value: CRON_WEEKDAYS[day],
      label: formatter.format(new Date(Date.UTC(2021, 7, 1 + day))),
    };
  });
}
