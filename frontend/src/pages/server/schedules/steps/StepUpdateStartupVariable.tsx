import { Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

export default function StepUpdateStartupVariable({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('common.form.envVariable', {})}
        value={form.getInputProps('action.envVariable').value}
        onChange={(v) => form.setFieldValue('action.envVariable', v)}
      />
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('common.form.value', {})}
        value={form.getInputProps('action.value').value}
        onChange={(v) => form.setFieldValue('action.value', v)}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
