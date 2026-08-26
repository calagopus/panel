import cronstrue from 'cronstrue/i18n';
import { useMemo, useState } from 'react';
import Group from '@/elements/Group.tsx';
import { CrontabEditor } from '@/elements/input/CronInput.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TimeInput from '@/elements/input/TimeInput.tsx';
import Popover from '@/elements/Popover.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import {
  CRON_WEEKDAYS,
  getLocalizedCronWeekdays,
  parseSimpleSchedule,
  SimpleSchedule,
  simpleScheduleToCron,
} from '@/lib/cron.ts';
import { isValidCronExpression } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import type { TriggerFormProps } from './TriggerForm.tsx';

export default function CronTriggerExtraForm({ form, index }: TriggerFormProps) {
  const { t, language } = useTranslations();
  const server = useServerStore((state) => state.server);
  const [advancedManual, setAdvancedManual] = useState(false);

  const trigger = form.values.triggers[index];
  const schedule = trigger.type === 'cron' ? trigger.schedule : '';
  const simple = useMemo(() => parseSimpleSchedule(schedule), [schedule]);

  const weekdayOptions = useMemo(() => getLocalizedCronWeekdays(language), [language]);

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

  const cronValid = isValidCronExpression(schedule);
  const description = cronValid ? cronstrue.toString(schedule, { locale: language }) : null;

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
              error={cronValid ? undefined : t('pages.server.schedules.triggers.cron.invalidCron', {})}
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
        {description && `${description} · `}
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
