import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupSelectorInput from '../BackupSelectorInput.tsx';

export default function StepDeleteBackup({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  const action = form.values.action;
  if (action.type !== 'delete_backup') {
    return null;
  }

  return (
    <Stack>
      <BackupSelectorInput form={form} backup={action.backup} />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
      <Text size='xs' c='dimmed'>
        {t('pages.server.schedules.steps.deleteBackup.form.warning', {})}
      </Text>
    </Stack>
  );
}
