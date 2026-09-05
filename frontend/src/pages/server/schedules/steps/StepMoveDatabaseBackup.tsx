import { UseFormReturnType } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import BackupSelectorInput from '../forms/BackupSelectorInput.tsx';
import DatabaseInstanceSelectorInput from '../forms/DatabaseInstanceSelectorInput.tsx';

export default function StepMoveDatabaseBackup({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
}) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canReadGroups = useServerCan('backup-groups.read');
  const { data: groups } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.groups.all(),
    queryFn: () => getBackupGroups(server.uuid),
    enabled: canReadGroups,
  });

  const action = form.values.action;
  if (action.type !== 'move_database_backup') {
    return null;
  }

  return (
    <Stack>
      <BackupSelectorInput
        form={form}
        backup={action.backup}
        label={t('pages.server.schedules.steps.moveDatabaseBackup.form.backupSelector', {})}
      />
      <DatabaseInstanceSelectorInput
        form={form}
        field='action.databaseInstanceUuid'
        label={t('pages.server.schedules.form.sourceDatabaseInstance', {})}
        description={t('pages.server.schedules.form.sourceDatabaseInstanceDescription', {})}
        placeholder={t('pages.server.schedules.form.sourceDatabaseInstanceAny', {})}
      />
      <Select
        label={t('pages.server.schedules.steps.moveBackup.form.targetGroup', {})}
        placeholder={t('pages.server.backups.modal.createBackup.noGroup', {})}
        clearable
        data={(groups ?? []).map((group) => ({
          value: group.uuid,
          label: group.name,
        }))}
        value={form.getInputProps('action.backupGroupUuid').value ?? null}
        error={form.getInputProps('action.backupGroupUuid').error}
        onChange={(v) => form.setFieldValue('action.backupGroupUuid', v)}
      />
      <Switch
        label={t('pages.server.schedules.form.ignoreFailure', {})}
        {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
      />
    </Stack>
  );
}
