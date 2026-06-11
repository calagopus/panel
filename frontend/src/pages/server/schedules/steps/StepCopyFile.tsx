import { Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

export default function StepCopyFile({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('pages.server.schedules.steps.copyFile.form.sourceFile', {})}
        placeholder={t('pages.server.schedules.steps.copyFile.form.sourceFile', {})}
        value={form.getInputProps('action.file').value}
        onChange={(v) => form.setFieldValue('action.file', v)}
      />
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('common.form.destination', {})}
        placeholder={t('common.form.destination', {})}
        value={form.getInputProps('action.destination').value}
        onChange={(v) => form.setFieldValue('action.destination', v)}
      />
      <Switch
        label={t('pages.server.schedules.form.runInForeground', {})}
        {...form.getInputProps('action.foreground', { type: 'checkbox' })}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
