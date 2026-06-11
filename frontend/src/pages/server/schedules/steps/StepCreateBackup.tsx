import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

export default function StepCreateBackup({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        label={t('pages.server.schedules.steps.createBackup.form.backupName', {})}
        placeholder={t('pages.server.schedules.steps.createBackup.form.backupName', {})}
        allowNull
        value={form.getInputProps('action.name').value}
        onChange={(v) => form.setFieldValue('action.name', v)}
      />
      <Group>
        <Switch
          label={t('pages.server.schedules.form.runInForeground', {})}
          {...form.getInputProps('action.foreground', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.server.schedules.form.ignoreFailure', {})}
          {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
        />
      </Group>
      <TagsInput
        label={t('common.form.ignoredFiles', {})}
        placeholder={t('common.form.ignoredFiles', {})}
        {...form.getInputProps('action.ignoredFiles')}
      />
    </Stack>
  );
}
