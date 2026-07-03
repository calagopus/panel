import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/Stack.tsx';
import { serverPowerStateLabelMapping } from '@/lib/enums.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function StepWaitForState({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <Select
        withAsterisk
        label={t('pages.server.schedules.form.serverState', {})}
        data={Object.entries(serverPowerStateLabelMapping).map(([value, label]) => ({
          value,
          label: label(),
        }))}
        {...form.getInputProps('action.state')}
      />
      <NumberInput
        withAsterisk
        label={t('pages.server.schedules.steps.waitForState.form.timeout', {})}
        placeholder='60000'
        min={1}
        {...form.getInputProps('action.timeout')}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
