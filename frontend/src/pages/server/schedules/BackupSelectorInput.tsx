import { UseFormReturnType } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ScheduleDynamicParameterInput from './ScheduleDynamicParameterInput.tsx';

type BackupSelector = Extract<
  z.infer<typeof serverScheduleStepUpdateSchema>['action'],
  { type: 'restore_backup' }
>['backup'];

export default function BackupSelectorInput({
  form,
  backup,
}: {
  form: UseFormReturnType<z.infer<typeof serverScheduleStepUpdateSchema>>;
  backup: BackupSelector;
}) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canReadGroups = useServerCan('backup-groups.read');
  const { data: groups } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.groups.all(),
    queryFn: () => getBackupGroups(server.uuid),
    enabled: canReadGroups,
  });

  return (
    <Stack>
      <Select
        withAsterisk
        label={t('pages.server.schedules.steps.restoreBackup.form.backupSelector', {})}
        data={(['latest', 'oldest', 'uuid', 'name'] as const).map((mode) => ({
          value: mode,
          label: t(`pages.server.schedules.steps.restoreBackup.form.selector.${mode}`, {}),
        }))}
        value={backup.mode}
        onChange={(mode) => {
          form.setFieldValue(
            'action.backup',
            mode === 'uuid'
              ? { mode: 'uuid', uuid: '' }
              : mode === 'name'
                ? { mode: 'name', name: '', backupGroupUuid: null, oldest: false }
                : { mode: mode as 'latest' | 'oldest', backupGroupUuid: null },
          );
        }}
      />
      {backup.mode === 'uuid' ? (
        <ScheduleDynamicParameterInput
          withAsterisk
          label={t('pages.server.schedules.steps.restoreBackup.form.backupUuid', {})}
          placeholder={t('pages.server.schedules.steps.restoreBackup.form.backupUuid', {})}
          value={backup.uuid}
          onChange={(v) => form.setFieldValue('action.backup.uuid', v)}
        />
      ) : backup.mode === 'name' ? (
        <ScheduleDynamicParameterInput
          withAsterisk
          label={t('pages.server.schedules.steps.restoreBackup.form.backupName', {})}
          placeholder={t('pages.server.schedules.steps.restoreBackup.form.backupName', {})}
          value={backup.name}
          onChange={(v) => form.setFieldValue('action.backup.name', v)}
        />
      ) : null}
      {backup.mode !== 'uuid' && groups && groups.length > 0 && (
        <Select
          label={t('pages.server.backupGroups.group', {})}
          placeholder={t('pages.server.backups.modal.createBackup.noGroup', {})}
          clearable
          data={groups.map((group) => ({
            value: group.uuid,
            label: group.name,
          }))}
          value={backup.backupGroupUuid ?? null}
          onChange={(v) => form.setFieldValue('action.backup.backupGroupUuid', v)}
        />
      )}
      {backup.mode === 'name' && (
        <Switch
          label={t('pages.server.schedules.steps.restoreBackup.form.selector.oldestFirst', {})}
          checked={backup.oldest ?? false}
          onChange={(e) => form.setFieldValue('action.backup.oldest', e.currentTarget.checked)}
        />
      )}
    </Stack>
  );
}
