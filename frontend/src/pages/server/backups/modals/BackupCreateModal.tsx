import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import createBackup from '@/api/server/backups/createBackup.ts';
import Button from '@/elements/Button.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { serverBackupCreateSchema } from '@/lib/schemas/server/backups.ts';
import { generateBackupName } from '@/lib/server.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function BackupCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addBackup = useServerStore((state) => state.addBackup);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverBackupCreateSchema>>({
    initialValues: {
      name: '',
      ignoredFiles: [],
    },
    validate: zod4Resolver(serverBackupCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const backup = await createBackup(server.uuid, values);
      addBackup(backup);
      addToast(t('pages.server.backups.modal.createBackup.toast.created', {}), 'success');
    },
  });

  useEffect(() => {
    form.setValues({
      name: generateBackupName(),
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
