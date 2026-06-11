import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateBackup from '@/api/server/backups/updateBackup.ts';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverBackupEditSchema, serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  backup: z.infer<typeof serverBackupSchema>;
};

export default function BackupEditModal({ backup, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverBackupEditSchema>>({
    initialValues: {
      name: backup.name,
      locked: backup.isLocked,
    },
    validate: zod4Resolver(serverBackupEditSchema),
    onClose,
    onSubmit: async (values) => {
      await updateBackup(server.uuid, backup.uuid, values);
      backup.name = values.name;
      backup.isLocked = values.locked;
      addToast(t('pages.server.backups.modal.editBackup.toast.updated', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.server.backups.modal.editBackup.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
      <Stack>
        <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

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
