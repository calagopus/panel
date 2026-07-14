import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import deleteBackupGroup from '@/api/server/backups/groups/deleteBackupGroup.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverBackupGroupSchema } from '@/lib/schemas/server/backups.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  group: z.infer<typeof serverBackupGroupSchema>;
};

export default function BackupGroupDeleteModal({ group, ...props }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm({
    initialValues: { name: '', lockBackups: false },
    validate: {
      name: (value) => (value !== group.name ? 'Name does not match' : null),
    },
    onClose: props.onClose,
    onSubmit: async (values) => {
      await deleteBackupGroup(server.uuid, group.uuid, values.lockBackups);
      addToast(t('pages.server.backupGroups.toast.deleted', {}), 'success');
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).backups.groups.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).backups.all(),
      });
    },
  });

  return (
    <FormModal
      title={t('pages.server.backupGroups.modal.deleteGroup.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Text>
          {t('pages.server.backupGroups.modal.deleteGroup.content', {
            name: group.name,
            backups: tItem('backup', group.totalBackups),
          }).md()}
        </Text>

        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        <Switch
          label={t('pages.server.backupGroups.modal.deleteGroup.lockBackups', {})}
          description={t('pages.server.backupGroups.modal.deleteGroup.lockBackupsDescription', {})}
          name='lockBackups'
          {...form.getInputProps('lockBackups', { type: 'checkbox' })}
        />

        <ModalFooter>
          <Button color='red' type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.delete', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
