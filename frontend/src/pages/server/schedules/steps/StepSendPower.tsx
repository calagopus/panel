import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { mappingToSelectData, serverPowerActionLabelMapping } from '@/lib/enums.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function StepSendPower({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();
  const canStart = useServerCan('control.start');
  const canStop = useServerCan('control.stop');
  const canRestart = useServerCan('control.restart');

  const allowedPowerActions: Record<keyof typeof serverPowerActionLabelMapping, boolean> = {
    start: canStart,
    stop: canStop,
    restart: canRestart,
    kill: canStop,
  };

  return (
    <Stack>
      <Select
        withAsterisk
        label={t('common.form.powerAction', {})}
        data={mappingToSelectData(serverPowerActionLabelMapping).map((item) => ({
          ...item,
          disabled: !allowedPowerActions[item.value as keyof typeof serverPowerActionLabelMapping],
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
