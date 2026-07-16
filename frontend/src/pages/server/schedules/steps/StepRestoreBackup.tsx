import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Group from '@/elements/Group.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupSelectorInput from '../BackupSelectorInput.tsx';

export default function StepRestoreBackup({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  const action = form.values.action;
  if (action.type !== 'restore_backup') {
    return null;
  }

  return (
    <Stack>
      <BackupSelectorInput form={form} backup={action.backup} />
      <Group>
        <Switch
          label={t('pages.server.schedules.steps.restoreBackup.form.truncateDirectory', {})}
          {...form.getInputProps('action.truncateDirectory', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.server.schedules.steps.restoreBackup.form.restoreStartup', {})}
          {...form.getInputProps('action.restoreStartup', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.server.schedules.form.ignoreFailure', {})}
          {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
        />
      </Group>
      <Text size='xs' c='dimmed'>
        {t('pages.server.schedules.steps.restoreBackup.form.warning', {})}
      </Text>
    </Stack>
  );
}
