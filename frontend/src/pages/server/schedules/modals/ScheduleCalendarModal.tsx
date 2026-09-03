import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { Schedule, ScheduleEventData, ScheduleViewLevel } from '@mantine/schedule';
import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue/i18n';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import getSchedules from '@/api/server/schedules/getSchedules.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const MAX_OCCURRENCES_PER_TRIGGER = 500;
const MAX_TOTAL_EVENTS = 300;
const EVENT_DURATION_MS = 30 * 60 * 1000;
const RATE_LIMIT_MS = 5 * 60 * 1000;
const VISIBLE_VIEWS: ScheduleViewLevel[] = ['day', 'week', 'month'];
const FIRST_DAY_OF_WEEK = 1;
const CATEGORICAL_COLORS = ['blue', 'orange', 'cyan', 'yellow', 'pink', 'green', 'violet', 'red'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const diff = (d.getDay() - FIRST_DAY_OF_WEEK + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function getVisibleRange(date: Date, view: ScheduleViewLevel): [Date, Date] {
  switch (view) {
    case 'day':
      return [startOfDay(date), endOfDay(date)];
    case 'week':
      return [startOfWeek(date), endOfWeek(date)];
    default:
      return [startOfWeek(startOfMonth(date)), endOfWeek(endOfMonth(date))];
  }
}

export default function ScheduleCalendarModal(props: ModalProps) {
  const { t, language } = useTranslations();
  const { server } = useServerStore();
  const navigate = useNavigate();

  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<ScheduleViewLevel>('week');

  const { data: schedules, loading } = useResource({
    queryKey: [...queryKeys.server(server.uuid).schedules.all(), 'calendar'],
    queryFn: () => getSchedules(server.uuid, 1, undefined, Math.max(server.featureLimits.schedules, 25)),
    enabled: props.opened,
  });

  const scheduleColors = useMemo(() => {
    const map = new Map<string, string>();
    if (!schedules) return map;

    let index = 0;
    for (const schedule of schedules.data) {
      if (!schedule.enabled || !schedule.triggers.some((trigger) => trigger.type === 'cron')) continue;

      map.set(schedule.uuid, CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]);
      index++;
    }

    return map;
  }, [schedules]);

  const isPreviousDisabled = useMemo(() => {
    const today = new Date();

    if (view === 'day') return startOfDay(date).getTime() <= startOfDay(today).getTime();
    if (view === 'week') return startOfWeek(date).getTime() <= startOfWeek(today).getTime();
    return startOfMonth(date).getTime() <= startOfMonth(today).getTime();
  }, [date, view]);

  const { events, truncated } = useMemo(() => {
    if (!schedules) return { events: [] as ScheduleEventData[], truncated: false };

    const timezone = server.timezone || 'UTC';
    const now = new Date();
    const [rangeStart, rangeEnd] = getVisibleRange(date, view);
    const from = rangeStart > now ? rangeStart : now;
    if (from > rangeEnd) return { events: [] as ScheduleEventData[], truncated: false };

    const list: ScheduleEventData[] = [];
    let truncated = false;

    outer: for (const schedule of schedules.data) {
      if (!schedule.enabled) continue;

      for (const trigger of schedule.triggers) {
        if (trigger.type !== 'cron') continue;

        let description: string;
        try {
          description = cronstrue.toString(trigger.schedule, { locale: language });
        } catch {
          description = t('pages.server.schedules.triggers.cron.invalidCron', {});
        }

        const color = scheduleColors.get(schedule.uuid) ?? CATEGORICAL_COLORS[0];

        let cursor = from;
        let lastIncluded: Date | null = null;
        let occurrenceCount = 0;

        while (occurrenceCount < MAX_OCCURRENCES_PER_TRIGGER) {
          let next: Date;
          try {
            next = CronExpressionParser.parse(trigger.schedule, { currentDate: cursor, tz: timezone }).next().toDate();
          } catch {
            break;
          }

          occurrenceCount++;
          if (next > rangeEnd) break;

          if (lastIncluded && next.getTime() - lastIncluded.getTime() < RATE_LIMIT_MS) {
            truncated = true;
            cursor = new Date(lastIncluded.getTime() + RATE_LIMIT_MS);
            continue;
          }

          lastIncluded = next;
          cursor = next;

          list.push({
            id: `${schedule.uuid}-${trigger.schedule}-${next.toISOString()}`,
            title: schedule.name,
            start: next,
            end: new Date(next.getTime() + EVENT_DURATION_MS),
            color,
            payload: { scheduleUuid: schedule.uuid, cronDescription: description },
          });

          if (list.length >= MAX_TOTAL_EVENTS) {
            truncated = true;
            break outer;
          }
        }

        if (occurrenceCount >= MAX_OCCURRENCES_PER_TRIGGER) truncated = true;
      }
    }

    return { events: list, truncated };
  }, [schedules, server.timezone, date, view, language, t, scheduleColors]);

  return (
    <Modal title={t('pages.server.schedules.modal.calendar.title', {})} {...props} size='xl'>
      {loading ? (
        <Spinner.Centered />
      ) : (
        <>
          {truncated && (
            <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />} mb='md'>
              {t('pages.server.schedules.modal.calendar.truncatedWarning', {})}
            </Alert>
          )}

          <Schedule
            date={date}
            onDateChange={(value) => setDate(new Date(value))}
            view={view}
            onViewChange={setView}
            events={events}
            withAgenda
            onEventClick={(event) => {
              const { scheduleUuid } = event.payload as { scheduleUuid: string };
              props.onClose?.();
              navigate(`/server/${server.uuidShort}/schedules/${scheduleUuid}`);
            }}
            dayViewProps={{
              viewSelectProps: { views: VISIBLE_VIEWS },
              previousControlProps: { disabled: isPreviousDisabled },
              withAllDaySlot: false,
            }}
            weekViewProps={{
              viewSelectProps: { views: VISIBLE_VIEWS },
              previousControlProps: { disabled: isPreviousDisabled },
              withAllDaySlots: false,
            }}
            monthViewProps={{
              viewSelectProps: { views: VISIBLE_VIEWS },
              previousControlProps: { disabled: isPreviousDisabled },
              monthYearSelectProps: {
                startYear: new Date().getFullYear(),
              },
            }}
            renderEventBody={(event) => {
              const { cronDescription } = event.payload as { scheduleUuid: string; cronDescription: string };

              return <Tooltip label={`${event.title} - ${cronDescription}`}>{event.title}</Tooltip>;
            }}
          />
        </>
      )}

      <ModalFooter>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
