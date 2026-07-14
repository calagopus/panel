import { ModalProps } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import getBackupGroups from '@/api/server/backups/groups/getBackupGroups.ts';
import updateBackup from '@/api/server/backups/updateBackup.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupEditSchema, serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  backup: z.infer<typeof serverBackupSchema>;
};

export default function BackupEditModal({ backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const canReadGroups = useServerCan('backup-groups.read');
  const { data: groups } = useQuery({
    queryKey: queryKeys.server(server.uuid).backups.groups.all(),
    queryFn: () => getBackupGroups(server.uuid),
    enabled: canReadGroups && props.opened,
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverBackupEditSchema>>({
    initialValues: {
      name: backup.name,
      locked: backup.isLocked,
      backupGroupUuid: backup.backupGroupUuid,
    },
    validate: zod4Resolver(serverBackupEditSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateBackup(server.uuid, backup.uuid, values);

      if (values.backupGroupUuid !== backup.backupGroupUuid) {
        for (const groupUuid of [backup.backupGroupUuid, values.backupGroupUuid]) {
          if (groupUuid) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.server(server.uuid).backups.groups.detail(groupUuid),
            });
          }
        }
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).backups.groups.all(),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).backups.all(),
        });
      }

      backup.name = values.name;
      backup.isLocked = values.locked;
      backup.backupGroupUuid = values.backupGroupUuid;
      addToast(t('pages.server.backups.modal.editBackup.toast.updated', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.server.backups.modal.editBackup.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        {canReadGroups && (groups ?? []).length > 0 && (
          <Select
            label={t('pages.server.backupGroups.group', {})}
            placeholder={t('pages.server.backups.modal.createBackup.noGroup', {})}
            clearable
            data={(groups ?? []).map((group) => ({
              value: group.uuid,
              label: group.name,
            }))}
            value={form.values.backupGroupUuid}
            onChange={(value) => form.setFieldValue('backupGroupUuid', value)}
          />
        )}

        <Switch
          label={t('common.form.locked', {})}
          name='locked'
          {...form.getInputProps('locked', { type: 'checkbox' })}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.save', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
