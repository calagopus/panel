import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import updateBackupGroup from '@/api/server/backups/groups/updateBackupGroup.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import BackupRetentionInput from '@/elements/input/BackupRetentionInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { isBackupRetentionDisabled } from '@/lib/schemas/backupRetention.ts';
import { serverBackupGroupSchema, serverBackupGroupUpdateSchema } from '@/lib/schemas/server/backups.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  group: z.infer<typeof serverBackupGroupSchema>;
};

export default function BackupGroupEditModal({ group, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverBackupGroupUpdateSchema>
  >({
    initialValues: {
      name: group.name,
      retention: group.retention,
    },
    schema: serverBackupGroupUpdateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateBackupGroup(server.uuid, group.uuid, values);
      queryClient.invalidateQueries({
        queryKey: queryKeys.server(server.uuid).backups.groups.all(),
      });
      addToast(t('pages.server.backupGroups.toast.updated', {}), 'success');
    },
  });

  useEffect(() => {
    if (props.opened) {
      form.setValues({
        name: group.name,
        retention: group.retention,
      });
      form.resetDirty();
    }
  }, [props.opened]);

  const retentionDisabled = isBackupRetentionDisabled(form.values.retention);

  return (
    <FormModal
      title={t('pages.server.backupGroups.modal.updateGroup.title', {})}
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
