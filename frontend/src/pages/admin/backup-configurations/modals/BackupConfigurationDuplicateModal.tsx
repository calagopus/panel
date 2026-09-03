import { ModalProps } from '@mantine/core';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import duplicateBackupConfiguration from '@/api/admin/backup-configurations/duplicateBackupConfiguration.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function BackupConfigurationDuplicateModal({
  backupConfiguration,
  ...props
}: ModalProps & { backupConfiguration: z.infer<typeof adminBackupConfigurationSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<{ name: string }>({
    initialValues: { name: '' },
    onClose: props.onClose,
    onSubmit: async ({ name }) => {
      const duplicated = await duplicateBackupConfiguration(backupConfiguration.uuid, name);
      addToast(
        t('common.toast.duplicated', { resource: t('pages.admin.backupConfigurations.resourceName', {}) }),
        'success',
      );
      navigate(`/admin/backup-configurations/${duplicated.uuid}`);
    },
  });

  useEffect(() => {
    if (!props.opened) {
      return;
    }

    const values = { name: `${backupConfiguration.name} (copy)` };
    form.setValues(values);
    form.resetDirty(values);
  }, [props.opened, backupConfiguration]);

  return (
    <FormModal
      title={t('common.modal.duplicate.title', { resource: t('pages.admin.backupConfigurations.resourceName', {}) })}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.newName', {})} {...form.getInputProps('name')} />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={form.values.name.length < 1}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
