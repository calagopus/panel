import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import TextArea from '@/elements/input/TextArea.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

export default function StepFormat({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <TextArea
        withAsterisk
        label={t('pages.server.schedules.steps.format.form.formatString', {})}
        description={t('pages.server.schedules.steps.format.form.formatStringDescription', { wrapper: '{{...}}' })}
        placeholder={t('pages.server.schedules.steps.format.form.formatString', {})}
        {...form.getInputProps('action.format')}
      />

      <ScheduleDynamicParameterInput
        label={t('pages.server.schedules.form.outputInto', {})}
        placeholder={t('pages.server.schedules.form.outputInto', {})}
        output
        allowString={false}
        value={form.getInputProps('action.outputInto').value}
        error={form.getInputProps('action.outputInto').error}
        onChange={(v) => form.setFieldValue('action.outputInto', v)}
      />
    </Stack>
  );
}
