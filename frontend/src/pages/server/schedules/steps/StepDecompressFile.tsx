import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

export default function StepDecompressFile({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('pages.server.schedules.form.rootPath', {})}
        placeholder={t('pages.server.schedules.form.rootPath', {})}
        value={form.getInputProps('action.root').value}
        error={form.getInputProps('action.root').error}
        onChange={(v) => form.setFieldValue('action.root', v)}
      />
      <ScheduleDynamicParameterInput
        withAsterisk
        label={t('pages.server.schedules.steps.decompressFile.form.file', {})}
        placeholder={t('pages.server.schedules.steps.decompressFile.form.file', {})}
        value={form.getInputProps('action.file').value}
        error={form.getInputProps('action.file').error}
        onChange={(v) => form.setFieldValue('action.file', v)}
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
