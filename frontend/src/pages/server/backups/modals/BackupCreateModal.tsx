import { ModalProps } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import createBackup from '@/api/server/backups/createBackup.ts';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import getDatabaseInstances from '@/api/server/databases/instances/getDatabaseInstances.ts';
import Button from '@/elements/buttons/Button.tsx';
import IgnoredFilesInput from '@/elements/input/IgnoredFilesInput.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { generateBackupName } from '@/lib/domain/server.ts';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupCreateSchema } from '@/lib/schemas/server/backups.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function BackupCreateModal({
  groupUuid,
  createDefaults,
  ...props
}: ModalProps & { groupUuid?: string; createDefaults?: { databaseInstanceUuid: string | null } }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const canReadGroups = useServerCan('backup-groups.read');
  const canReadInstances = useServerCan('database-instances.read');
  const { data: groups } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.groups.all(),
    queryFn: () => getBackupGroups(server.uuid),
    enabled: canReadGroups,
  });

  const instances = useSearchableResource<z.infer<typeof serverDatabaseInstanceSchema>>({
    queryKey: queryKeys.server(server.uuid).databases.instances.all(),
    fetcher: (search) => getDatabaseInstances(server.uuid, 1, search),
    canRequest: canReadInstances && props.opened,
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverBackupCreateSchema>>({
    initialValues: {
      name: '',
      backupGroupUuid: groupUuid ?? null,
      databaseInstanceUuid: createDefaults?.databaseInstanceUuid ?? null,
      ignoredFiles: [],
    },
    validate: zod4Resolver(serverBackupCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createBackup(server.uuid, values);

      queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).backups.all() });

      addToast(t('pages.server.backups.modal.createBackup.toast.created', {}), 'success');
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = {
        name: generateBackupName(),
        backupGroupUuid: groupUuid ?? null,
        databaseInstanceUuid: createDefaults?.databaseInstanceUuid ?? null,
        ignoredFiles: [],
      };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  const sourceKindLocked = !!createDefaults?.databaseInstanceUuid;
  const isDatabase = form.values.databaseInstanceUuid !== null;

  return (
    <FormModal
      title={t('pages.server.backups.modal.createBackup.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        {canReadInstances && (
          <>
            {!sourceKindLocked && (
              <Select
                label={t('pages.server.backups.modal.createBackup.source', {})}
                data={[
                  { value: 'files', label: t('pages.server.backups.modal.createBackup.sourceFiles', {}) },
                  { value: 'database', label: t('pages.server.backups.modal.createBackup.sourceDatabase', {}) },
                ]}
                value={isDatabase ? 'database' : 'files'}
                onChange={(value) => form.setFieldValue('databaseInstanceUuid', value === 'database' ? '' : null)}
              />
            )}

            {isDatabase && (
              <Select
                withAsterisk
                label={t('pages.server.backups.modal.createBackup.sourceInstance', {})}
                data={instances.items.map((instance) => ({
                  value: instance.uuid,
                  label: `${instance.name} (${databaseAgentTypeLabelMapping[instance.type]})`,
                }))}
                value={form.values.databaseInstanceUuid || null}
                searchable
                searchValue={instances.search}
                onSearchChange={instances.setSearch}
                loading={instances.loading}
                onChange={(value) => form.setFieldValue('databaseInstanceUuid', value ?? '')}
              />
            )}
          </>
        )}

        {groups && groups.length > 0 && (
          <Select
            label={t('pages.server.backupGroups.group', {})}
            placeholder={t('pages.server.backups.modal.createBackup.noGroup', {})}
            clearable={!groupUuid}
            disabled={!!groupUuid}
            data={groups.map((group) => ({
              value: group.uuid,
              label: group.name,
            }))}
            value={form.values.backupGroupUuid ?? null}
            onChange={(value) => form.setFieldValue('backupGroupUuid', value)}
          />
        )}

        {!isDatabase && (
          <IgnoredFilesInput
            serverUuid={server.uuid}
            label={t('common.form.ignoredFiles', {})}
            value={form.values.ignoredFiles}
            onChange={(value) => form.setFieldValue('ignoredFiles', value)}
          />
        )}

        <ModalFooter>
          <Button
            type='submit'
            loading={loading}
            disabled={!form.isValid() || (isDatabase && !form.values.databaseInstanceUuid)}
          >
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
