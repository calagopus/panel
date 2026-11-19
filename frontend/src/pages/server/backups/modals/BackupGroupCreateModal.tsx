import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import createBackupGroup from '@/api/server/backups/groups/createBackupGroup.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import BackupRetentionInput from '@/elements/input/BackupRetentionInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { emptyBackupRetention, isBackupRetentionDisabled } from '@/lib/schemas/backupRetention.ts';
import { serverBackupGroupCreateSchema } from '@/lib/schemas/server/backups.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function BackupGroupCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverBackupGroupCreateSchema>
  >({
    initialValues: {
      name: '',
      retention: { ...emptyBackupRetention },
    },
    schema: serverBackupGroupCreateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createBackupGroup(server.uuid, values);
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).backups.groups.all(),
      });
      addToast(t('pages.server.backupGroups.toast.created', {}), 'success');
    },
  });

  const retentionDisabled = isBackupRetentionDisabled(form.values.retention);

  return (
    <FormModal
      title={t('pages.server.backupGroups.modal.createGroup.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

        <BackupRetentionInput form={form} path='retention' label={t('common.elements.backupRetention.title', {})}>
          <p className='text-sm text-(--mantine-color-dimmed)'>
            {t('common.elements.backupRetention.capacityDescription', {})}
          </p>
          <p className='text-sm text-(--mantine-color-dimmed)'>
            {t('common.elements.backupRetention.failedDescription', {})}
          </p>
        </BackupRetentionInput>

        {retentionDisabled && (
          <Alert color='blue' icon={faCircleInfo}>
            {t('pages.server.backupGroups.form.noRetentionDescription', {})}
          </Alert>
        )}

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
