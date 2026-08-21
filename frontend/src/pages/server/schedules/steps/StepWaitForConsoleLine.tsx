import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/Stack.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ScheduleDynamicParameterInput from '../ScheduleDynamicParameterInput.tsx';

export default function StepWaitForConsoleLine({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        label={t('common.form.lineContains', {})}
        value={form.getInputProps('action.contains').value}
        error={form.getInputProps('action.contains').error}
        onChange={(v) => form.setFieldValue('action.contains', v)}
      />
      <Switch
        label={t('common.form.caseInsensitive', {})}
        {...form.getInputProps('action.caseInsensitive', { type: 'checkbox' })}
      />
      <NumberInput
        withAsterisk
        label={t('pages.server.schedules.steps.waitForConsoleLine.form.timeout', {})}
        placeholder='1000'
        min={1}
        {...form.getInputProps('action.timeout')}
      />
      <ScheduleDynamicParameterInput
        label={t('pages.server.schedules.form.outputInto', {})}
        allowNull
        output
        allowString={false}
        value={form.getInputProps('action.outputInto').value}
        error={form.getInputProps('action.outputInto').error}
        onChange={(v) => form.setFieldValue('action.outputInto', v)}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
