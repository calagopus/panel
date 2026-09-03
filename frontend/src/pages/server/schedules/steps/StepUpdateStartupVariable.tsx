import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

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
        error={form.getInputProps('action.envVariable').error}
        onChange={(v) => form.setFieldValue('action.envVariable', v)}
      />
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('common.form.value', {})}
        value={form.getInputProps('action.value').value}
        error={form.getInputProps('action.value').error}
        onChange={(v) => form.setFieldValue('action.value', v)}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
