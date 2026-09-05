import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupSelectorInput from '../forms/BackupSelectorInput.tsx';
import DatabaseInstanceSelectorInput from '../forms/DatabaseInstanceSelectorInput.tsx';

export default function StepRestoreDatabaseBackup({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();

  const action = form.values.action;
  if (action.type !== 'restore_database_backup') {
    return null;
  }

  return (
    <Stack>
      <BackupSelectorInput
        form={form}
        backup={action.backup}
        label={t('pages.server.schedules.steps.restoreDatabaseBackup.form.backupSelector', {})}
      />
      <DatabaseInstanceSelectorInput
        form={form}
        field='action.sourceDatabaseInstanceUuid'
        label={t('pages.server.schedules.form.sourceDatabaseInstance', {})}
        description={t('pages.server.schedules.form.sourceDatabaseInstanceDescription', {})}
        placeholder={t('pages.server.schedules.form.sourceDatabaseInstanceAny', {})}
      />
      <DatabaseInstanceSelectorInput
        form={form}
        field='action.databaseInstanceUuid'
        label={t('pages.server.schedules.steps.restoreDatabaseBackup.form.targetDatabaseInstance', {})}
        description={t('pages.server.schedules.steps.restoreDatabaseBackup.form.targetDatabaseInstanceDescription', {})}
        placeholder={t('pages.server.schedules.steps.restoreDatabaseBackup.form.targetDatabaseInstanceSource', {})}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
      <Text size='xs' c='dimmed'>
        {t('pages.server.schedules.steps.restoreDatabaseBackup.form.warning', {})}
      </Text>
    </Stack>
  );
}
