import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupSelectorInput from '../forms/BackupSelectorInput.tsx';

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
      <BackupSelectorInput
        form={form}
        backup={action.backup}
        label={t('pages.server.schedules.steps.restoreBackup.form.backupSelector', {})}
      />
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
