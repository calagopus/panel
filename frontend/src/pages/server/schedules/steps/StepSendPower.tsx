import { Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { serverPowerActionLabelMapping } from '@/lib/enums.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function StepSendPower({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  return (
    <Stack>
      <Select
        withAsterisk
        label={t('common.form.powerAction', {})}
        data={Object.entries(serverPowerActionLabelMapping).map(([value, label]) => ({
          value,
          label: label(),
        }))}
        {...form.getInputProps('action.action')}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
