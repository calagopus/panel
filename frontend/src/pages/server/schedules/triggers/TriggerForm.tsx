import { UseFormReturnType } from '@mantine/form';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getSchedules from '@/api/server/schedules/getSchedules.ts';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import {
  mappingToSelectData,
  scheduleComparatorLabelMapping,
  scheduleResourceMetricLabelMapping,
  serverBackupStatusLabelMapping,
  serverPowerActionLabelMapping,
  serverPowerStateLabelMapping,
} from '@/lib/enums.ts';
import { serverScheduleTriggerSchema, serverScheduleUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';
import CronTriggerExtraForm from './CronTriggerExtraForm.tsx';

export interface TriggerFormProps {
  form: UseFormReturnType<z.infer<typeof serverScheduleUpdateSchema>>;
  index: number;
}

function PowerActionTriggerForm({ form, index }: TriggerFormProps) {
  const { t } = useTranslations();

  if (form.values.triggers[index].type !== 'power_action') return null;

  return (
    <Select
      withAsterisk
      label={t('common.form.powerAction', {})}
      className='flex-1'
      data={mappingToSelectData(serverPowerActionLabelMapping)}
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
      data={mappingToSelectData(serverPowerStateLabelMapping)}
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
      data={mappingToSelectData(serverBackupStatusLabelMapping)}
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
      data={mappingToSelectData(scheduleResourceMetricLabelMapping)}
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
        data={mappingToSelectData(scheduleComparatorLabelMapping)}
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
        output
        allowString={false}
        value={form.values.triggers[index].outputInto}
        error={form.getInputProps(`triggers.${index}.outputInto`).error}
        onChange={(v) => form.setFieldValue(`triggers.${index}.outputInto`, v)}
      />
      <Switch
        label={t('common.form.caseInsensitive', {})}
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
