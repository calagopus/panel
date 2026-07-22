import { UseFormReturnType } from '@mantine/form';
import cronstrue from 'cronstrue/i18n';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import getSchedules from '@/api/server/schedules/getSchedules.ts';
import Group from '@/elements/Group.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TimeInput from '@/elements/input/TimeInput.tsx';
import Popover from '@/elements/Popover.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import {
  scheduleComparatorLabelMapping,
  scheduleResourceMetricLabelMapping,
  serverBackupStatusLabelMapping,
  serverPowerActionLabelMapping,
  serverPowerStateLabelMapping,
} from '@/lib/enums.ts';
import { serverScheduleTriggerSchema, serverScheduleUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

const CRON_SEGMENTS = ['Second', 'Minute', 'Hour', 'Day', 'Month', 'Weekday'] as const;
const CRON_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

type SimpleSchedule =
  | { frequency: 'everyMinutes'; interval: number }
  | { frequency: 'everyHours'; interval: number }
  | { frequency: 'daily'; hour: number; minute: number }
  | { frequency: 'weekly'; weekday: (typeof CRON_WEEKDAYS)[number]; hour: number; minute: number }
  | { frequency: 'monthly'; day: number; hour: number; minute: number };

function parseSimpleSchedule(schedule: string): SimpleSchedule | null {
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

function simpleScheduleToCron(schedule: SimpleSchedule): string {
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

interface CrontabEditorProps {
  value: string;
  setValue: (value: string) => void;
}

function CrontabEditor({ value, setValue }: CrontabEditorProps) {
  const [segments, setSegments] = useState(['0', '*', '*', '*', '*', '*']);

  useEffect(() => {
    const newSegments = value.split(' ');
    if (segments.every((s, i) => newSegments[i] === s)) {
      return;
    }

    for (let i = 0; i < CRON_SEGMENTS.length; i++) {
      if (!newSegments[i]) {
        newSegments[i] = i === 0 ? '0' : '*';
      }
    }

    setSegments(newSegments);
  }, [segments, value]);

  const setSegment = (index: number, value: string) => {
    const newSegments = [...segments.slice(0, index), value, ...segments.slice(index + 1)];
    setSegments(newSegments);

    setValue(newSegments.join(' '));
  };

  return (
    <div className='grid grid-cols-3 gap-2 w-64'>
      {CRON_SEGMENTS.map((label, i) => (
        <TextInput
          key={label}
          label={label}
          placeholder={label}
          value={segments[i]}
          className='flex-1'
          onChange={(e) => setSegment(i, e.target.value)}
        />
      ))}
    </div>
  );
}

interface TriggerFormProps {
  form: UseFormReturnType<z.infer<typeof serverScheduleUpdateSchema>>;
  index: number;
}

function CronTriggerExtraForm({ form, index }: TriggerFormProps) {
  const { t, language } = useTranslations();
  const server = useServerStore((state) => state.server);
  const [advancedManual, setAdvancedManual] = useState(false);

  const trigger = form.values.triggers[index];
  const schedule = trigger.type === 'cron' ? trigger.schedule : '';
  const simple = useMemo(() => parseSimpleSchedule(schedule), [schedule]);

  const weekdayOptions = useMemo(() => {
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
  }, [language]);

  if (trigger.type !== 'cron') return null;

  const advanced = advancedManual || !simple;

  const setSchedule = (value: string) => form.setFieldValue(`triggers.${index}.schedule`, value);
  const setSimple = (value: SimpleSchedule) => setSchedule(simpleScheduleToCron(value));

  const handleFrequencyChange = (frequency: string) => {
    const hour = simple && 'hour' in simple ? simple.hour : 0;
    const minute = simple && 'minute' in simple ? simple.minute : 0;

    switch (frequency) {
      case 'everyMinutes':
        setSimple({ frequency, interval: 30 });
        break;
      case 'everyHours':
        setSimple({ frequency, interval: 6 });
        break;
      case 'daily':
        setSimple({ frequency, hour, minute });
        break;
      case 'weekly':
        setSimple({ frequency, weekday: 'SUN', hour, minute });
        break;
      case 'monthly':
        setSimple({ frequency, day: 1, hour, minute });
        break;
    }
  };

  const handleTimeChange = (value: string) => {
    if (!simple || !('hour' in simple)) return;

    const [hour, minute] = value.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return;

    setSimple({ ...simple, hour, minute });
  };

  let description: string;
  try {
    description = cronstrue.toString(schedule, { locale: language });
  } catch {
    description = t('pages.server.schedules.triggers.cron.invalidCron', {});
  }

  const timeValue =
    simple && 'hour' in simple
      ? `${String(simple.hour).padStart(2, '0')}:${String(simple.minute).padStart(2, '0')}`
      : '00:00';

  return (
    <Stack gap='xs'>
      {advanced ? (
        <Popover>
          <Popover.Target>
            <TextInput
              withAsterisk
              label={t('pages.server.schedules.triggers.cron.form.cronSchedule', {})}
              {...form.getInputProps(`triggers.${index}.schedule`)}
            />
          </Popover.Target>
          <Popover.Dropdown>
            <CrontabEditor value={schedule} setValue={setSchedule} />
          </Popover.Dropdown>
        </Popover>
      ) : (
        <Group align='end' gap='sm'>
          <Select
            label={t('pages.server.schedules.triggers.cron.form.frequency', {})}
            className='flex-1'
            value={simple!.frequency}
            onChange={(value) => value && handleFrequencyChange(value)}
            data={[
              { value: 'everyMinutes', label: t('pages.server.schedules.triggers.cron.frequency.everyMinutes', {}) },
              { value: 'everyHours', label: t('pages.server.schedules.triggers.cron.frequency.everyHours', {}) },
              { value: 'daily', label: t('pages.server.schedules.triggers.cron.frequency.daily', {}) },
              { value: 'weekly', label: t('pages.server.schedules.triggers.cron.frequency.weekly', {}) },
              { value: 'monthly', label: t('pages.server.schedules.triggers.cron.frequency.monthly', {}) },
            ]}
          />

          {simple!.frequency === 'everyMinutes' && (
            <NumberInput
              label={t('pages.server.schedules.triggers.cron.form.intervalMinutes', {})}
              className='w-40'
              min={1}
              max={59}
              value={simple!.interval}
              onChange={(value) => setSimple({ frequency: 'everyMinutes', interval: Number(value) || 1 })}
            />
          )}
          {simple!.frequency === 'everyHours' && (
            <NumberInput
              label={t('pages.server.schedules.triggers.cron.form.intervalHours', {})}
              className='w-40'
              min={1}
              max={23}
              value={simple!.interval}
              onChange={(value) => setSimple({ frequency: 'everyHours', interval: Number(value) || 1 })}
            />
          )}
          {simple!.frequency === 'weekly' && (
            <Select
              label={t('pages.server.schedules.triggers.cron.form.weekday', {})}
              className='w-40'
              value={simple!.weekday}
              onChange={(value) =>
                value &&
                simple!.frequency === 'weekly' &&
                setSimple({ ...simple!, weekday: value as (typeof CRON_WEEKDAYS)[number] })
              }
              data={weekdayOptions}
            />
          )}
          {simple!.frequency === 'monthly' && (
            <NumberInput
              label={t('pages.server.schedules.triggers.cron.form.dayOfMonth', {})}
              className='w-40'
              min={1}
              max={31}
              value={simple!.day}
              onChange={(value) =>
                simple!.frequency === 'monthly' &&
                setSimple({ ...simple!, day: Math.min(Math.max(Number(value) || 1, 1), 31) })
              }
            />
          )}
          {(simple!.frequency === 'daily' || simple!.frequency === 'weekly' || simple!.frequency === 'monthly') && (
            <TimeInput
              label={t('pages.server.schedules.triggers.cron.form.time', {})}
              className='w-40'
              value={timeValue}
              onChange={(e) => handleTimeChange(e.currentTarget.value)}
            />
          )}
        </Group>
      )}

      <Text c='dimmed' size='sm'>
        {description} &middot;{' '}
        {t('pages.server.schedules.triggers.cron.timezoneHint', { timezone: server.timezone || 'UTC' })}
      </Text>

      <Switch
        label={t('pages.server.schedules.triggers.cron.form.advanced', {})}
        checked={advanced}
        onChange={(e) => {
          const enabled = e.currentTarget.checked;
          setAdvancedManual(enabled);
          if (!enabled && !simple) {
            setSchedule('0 0 0 * * *');
          }
        }}
      />
    </Stack>
  );
}

function PowerActionTriggerForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  if (form.values.triggers[index].type !== 'power_action') return null;

  return (
    <Select
      withAsterisk
      label={t('common.form.powerAction', {})}
      className='flex-1'
      data={Object.entries(serverPowerActionLabelMapping).map(([value, label]) => ({
        value,
        label: label(),
      }))}
      {...form.getInputProps(`triggers.${index}.action`)}
    />
  );
}

function ServerStateTriggerForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  if (form.values.triggers[index].type !== 'server_state') return null;

  return (
    <Select
      withAsterisk
      label={t('pages.server.schedules.form.serverState', {})}
      className='flex-1'
      data={Object.entries(serverPowerStateLabelMapping).map(([value, label]) => ({
        value,
        label: label(),
      }))}
      {...form.getInputProps(`triggers.${index}.state`)}
    />
  );
}

function BackupStatusTriggerForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  if (form.values.triggers[index].type !== 'backup_status') return null;

  return (
    <Select
      withAsterisk
      label={t('pages.server.schedules.triggers.backupStatus.form.backupStatus', {})}
      className='flex-1'
      data={Object.entries(serverBackupStatusLabelMapping).map(([value, label]) => ({
        value,
        label: label(),
      }))}
      {...form.getInputProps(`triggers.${index}.status`)}
    />
  );
}

function ScheduleCompletionTriggerForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const currentSchedule = useServerStore((state) => state.schedule);
  const [schedules, setSchedules] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    getSchedules(server.uuid, 1).then((page) =>
      setSchedules(
        page.data
          .filter((schedule) => schedule.uuid !== currentSchedule?.uuid)
          .map((schedule) => ({ value: schedule.uuid, label: schedule.name })),
      ),
    );
  }, [server.uuid, currentSchedule?.uuid]);

  if (form.values.triggers[index].type !== 'schedule_completion') return null;

  return (
    <Select
      withAsterisk
      searchable
      label={t('pages.server.schedules.triggers.scheduleCompletion.form.schedule', {})}
      className='flex-1'
      data={schedules}
      {...form.getInputProps(`triggers.${index}.schedule`)}
    />
  );
}

function ScheduleCompletionExtraForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  const trigger = form.values.triggers[index];
  if (trigger.type !== 'schedule_completion') return null;

  return (
    <Select
      label={t('pages.server.schedules.triggers.scheduleCompletion.form.completionStatus', {})}
      value={trigger.successful ? 'successful' : 'failed'}
      onChange={(value) => value && form.setFieldValue(`triggers.${index}.successful`, value === 'successful')}
      data={[
        { value: 'successful', label: t('common.badge.successful', {}) },
        { value: 'failed', label: t('common.badge.failed', {}) },
      ]}
    />
  );
}

function ResourceUsageTriggerForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  if (form.values.triggers[index].type !== 'resource_usage') return null;

  return (
    <Select
      withAsterisk
      label={t('pages.server.schedules.condition.metric', {})}
      className='flex-1'
      data={Object.entries(scheduleResourceMetricLabelMapping).map(([value, label]) => ({
        value,
        label: label(),
      }))}
      {...form.getInputProps(`triggers.${index}.metric`)}
    />
  );
}

function ResourceUsageExtraForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  const trigger = form.values.triggers[index];
  if (trigger.type !== 'resource_usage') return null;

  return (
    <Group grow align='end'>
      <Select
        label={t('pages.server.schedules.form.comparator', {})}
        data={Object.entries(scheduleComparatorLabelMapping).map(([value, label]) => ({
          value,
          label: label(),
        }))}
        {...form.getInputProps(`triggers.${index}.comparator`)}
      />
      {trigger.metric === 'cpu' ? (
        <NumberInput
          label={t('pages.server.schedules.preCondition.valuePercent', {})}
          min={0}
          value={trigger.value}
          onChange={(value) => form.setFieldValue(`triggers.${index}.value`, Number(value) || 0)}
        />
      ) : (
        <SizeInput
          label={t('pages.server.schedules.preCondition.value', {})}
          mode='b'
          min={0}
          value={trigger.value}
          onChange={(value) => form.setFieldValue(`triggers.${index}.value`, value)}
        />
      )}
      <NumberInput
        label={t('pages.server.schedules.triggers.resourceUsage.form.forSeconds', {})}
        min={0}
        max={24 * 60 * 60}
        {...form.getInputProps(`triggers.${index}.forSeconds`)}
      />
    </Group>
  );
}

function ConsoleLineTriggerForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  if (form.values.triggers[index].type !== 'console_line') return null;

  return (
    <TextInput
      withAsterisk
      label={t('common.form.lineContains', {})}
      className='flex-1'
      {...form.getInputProps(`triggers.${index}.contains`)}
    />
  );
}

function ConsoleLineExtraForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  if (form.values.triggers[index].type !== 'console_line') return null;

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        label={t('pages.server.schedules.form.outputInto', {})}
        allowNull
        allowString={false}
        value={form.values.triggers[index].outputInto}
        onChange={(v) => form.setFieldValue(`triggers.${index}.outputInto`, v)}
      />
      <Switch
        label={t('pages.server.schedules.form.caseInsensitive', {})}
        checked={form.values.triggers[index].caseInsensitive}
        onChange={(e) => form.setFieldValue(`triggers.${index}.caseInsensitive`, e.currentTarget.checked)}
      />
    </Stack>
  );
}

type ServerScheduleTriggerType = z.infer<typeof serverScheduleTriggerSchema>['type'];

const TRIGGER_INLINE_FORMS: Record<ServerScheduleTriggerType, React.FC<TriggerFormProps> | null> = {
  cron: null,
  power_action: PowerActionTriggerForm,
  server_state: ServerStateTriggerForm,
  backup_status: BackupStatusTriggerForm,
  schedule_completion: ScheduleCompletionTriggerForm,
  resource_usage: ResourceUsageTriggerForm,
  console_line: ConsoleLineTriggerForm,
  crash: null,
};

const TRIGGER_EXTRA_FORMS: Record<ServerScheduleTriggerType, React.FC<TriggerFormProps> | null> = {
  cron: CronTriggerExtraForm,
  power_action: null,
  server_state: null,
  backup_status: null,
  schedule_completion: ScheduleCompletionExtraForm,
  resource_usage: ResourceUsageExtraForm,
  console_line: ConsoleLineExtraForm,
  crash: null,
};

export function TriggerInlineForm({ form, index }: TriggerFormProps) {
  const FormComponent = TRIGGER_INLINE_FORMS[form.values.triggers[index].type];
  if (!FormComponent) return null;
  return <FormComponent form={form} index={index} />;
}

export function TriggerExtraForm({ form, index }: TriggerFormProps) {
  const FormComponent = TRIGGER_EXTRA_FORMS[form.values.triggers[index].type];
  if (!FormComponent) return null;
  return <FormComponent form={form} index={index} />;
}
