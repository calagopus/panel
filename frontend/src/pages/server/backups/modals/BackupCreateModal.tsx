import { ModalProps } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import createBackup from '@/api/server/backups/createBackup.ts';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupCreateSchema } from '@/lib/schemas/server/backups.ts';
import { generateBackupName } from '@/lib/server.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function BackupCreateModal({ groupUuid, ...props }: ModalProps & { groupUuid?: string }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addBackup = useServerStore((state) => state.addBackup);
  const queryClient = useQueryClient();

  const canReadGroups = useServerCan('backup-groups.read');
  const { data: groups } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.groups.all(),
    queryFn: () => getBackupGroups(server.uuid),
    enabled: canReadGroups,
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverBackupCreateSchema>>({
    initialValues: {
      name: '',
      backupGroupUuid: groupUuid ?? null,
      ignoredFiles: [],
    },
    validate: zod4Resolver(serverBackupCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const backup = await createBackup(server.uuid, values);
      if (values.backupGroupUuid) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).backups.groups.detail(values.backupGroupUuid),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).backups.groups.all(),
        });
      } else {
        addBackup(backup);
      }
      addToast(t('pages.server.backups.modal.createBackup.toast.created', {}), 'success');
    },
  });

  useEffect(() => {
    form.setValues({
      name: generateBackupName(),
      backupGroupUuid: groupUuid ?? null,
      ignoredFiles: [],
    });
  }, [props.opened]);

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

        <TagsInput label={t('common.form.ignoredFiles', {})} {...form.getInputProps('ignoredFiles')} />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
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
