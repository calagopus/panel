import { Popover, Stack, Text } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import cronstrue from 'cronstrue/i18n';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import {
  serverBackupStatusLabelMapping,
  serverPowerActionLabelMapping,
  serverPowerStateLabelMapping,
} from '@/lib/enums.ts';
import { serverScheduleTriggerSchema, serverScheduleUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

const CRON_SEGMENTS = ['Second', 'Minute', 'Hour', 'Day', 'Month', 'Weekday'] as const;

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

function CronTriggerForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  if (form.values.triggers[index].type !== 'cron') return null;

  return (
    <Popover>
      <Popover.Target>
        <TextInput
          withAsterisk
          label={t('pages.server.schedules.triggers.cron.form.cronSchedule', {})}
          className='flex-1'
          {...form.getInputProps(`triggers.${index}.schedule`)}
        />
      </Popover.Target>
      <Popover.Dropdown>
        <CrontabEditor
          value={form.values.triggers[index].schedule}
          setValue={(value) => form.setFieldValue(`triggers.${index}.schedule`, value)}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

function CronTriggerExtraForm({ form, index }: TriggerFormProps) {
  const { t, language } = useTranslations();

  if (form.values.triggers[index].type !== 'cron') return null;

  let description: string;
  try {
    description = cronstrue.toString(form.values.triggers[index].schedule, { locale: language });
  } catch {
    description = t('pages.server.schedules.triggers.cron.invalidCron', {});
  }

  return <Text c='dimmed'>{description}</Text>;
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
  cron: CronTriggerForm,
  power_action: PowerActionTriggerForm,
  server_state: ServerStateTriggerForm,
  backup_status: BackupStatusTriggerForm,
  console_line: ConsoleLineTriggerForm,
  crash: null,
};

const TRIGGER_EXTRA_FORMS: Record<ServerScheduleTriggerType, React.FC<TriggerFormProps> | null> = {
  cron: CronTriggerExtraForm,
  power_action: null,
  server_state: null,
  backup_status: null,
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
