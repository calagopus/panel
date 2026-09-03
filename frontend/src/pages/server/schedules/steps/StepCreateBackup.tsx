import { UseFormReturnType } from '@mantine/form';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import IgnoredFilesInput from '@/elements/input/IgnoredFilesInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverScheduleStepUpdateSchema } from '@/lib/schemas/server/schedules.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import ScheduleDynamicParameterInput from '../forms/ScheduleDynamicParameterInput.tsx';

export default function StepCreateBackup({
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

  return (
    <Stack>
      <ScheduleDynamicParameterInput
        label={t('pages.server.schedules.steps.createBackup.form.backupName', {})}
        placeholder={t('pages.server.schedules.steps.createBackup.form.backupName', {})}
        allowNull
        value={form.getInputProps('action.name').value}
        error={form.getInputProps('action.name').error}
        onChange={(v) => form.setFieldValue('action.name', v)}
      />
      {groups && groups.length > 0 && (
        <Select
          label={t('pages.server.backupGroups.group', {})}
          placeholder={t('pages.server.backups.modal.createBackup.noGroup', {})}
          clearable
          data={groups.map((group) => ({
            value: group.uuid,
            label: group.name,
          }))}
          value={form.getInputProps('action.backupGroupUuid').value ?? null}
          error={form.getInputProps('action.backupGroupUuid').error}
          onChange={(v) => form.setFieldValue('action.backupGroupUuid', v)}
        />
      )}
      <Group>
        <Switch
          label={t('pages.server.schedules.form.runInForeground', {})}
          {...form.getInputProps('action.foreground', { type: 'checkbox' })}
        />
        <Switch
          label={t('pages.server.schedules.form.ignoreFailure', {})}
          {...form.getInputProps('action.ignoreFailure', { type: 'checkbox' })}
        />
      </Group>
      <IgnoredFilesInput
        serverUuid={server.uuid}
        label={t('common.form.ignoredFiles', {})}
        value={form.getInputProps('action.ignoredFiles').value ?? []}
        onChange={(value) => form.setFieldValue('action.ignoredFiles', value)}
      />
      <ScheduleDynamicParameterInput
        label={t('pages.server.schedules.steps.createBackup.form.outputInto', {})}
        allowNull
        output
        allowString={false}
        value={form.getInputProps('action.outputInto').value}
        error={form.getInputProps('action.outputInto').error}
        onChange={(v) => form.setFieldValue('action.outputInto', v)}
      />
    </Stack>
  );
}
