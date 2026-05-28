import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import renameFiles from '@/api/server/files/renameFiles.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDirectoryEntrySchema, serverFilesNameSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

export default function FileRenameModal({ file, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { browsingDirectory, selectedFiles, addSelectedFile, removeSelectedFile, invalidateFilemanager } =
    useFileManager();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverFilesNameSchema>>({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(serverFilesNameSchema),
    onClose,
    onSubmit: async (values) => {
      if (!file) return;

      const { renamed } = await renameFiles({
        uuid: server.uuid,
        root: browsingDirectory,
        files: [
          {
            from: file.name,
            to: values.name,
          },
        ],
      });

      if (renamed < 1) {
        addToast(t('pages.server.files.toast.fileCouldNotBeRenamed', {}), 'error');
        return;
      }

      addToast(t('pages.server.files.toast.fileRenamed', {}), 'success');
      invalidateFilemanager();
      if (selectedFiles.has(file)) {
        removeSelectedFile(file);
        file.name = values.name;
        addSelectedFile(file);
      }
    },
  });

  useEffect(() => {
    if (file) {
      form.setValues({
        name: file.name,
      });
    }
  }, [file]);

  return (
    <FormModal
      title={t('pages.server.files.modal.renameFile.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
      <TextInput
        withAsterisk
        label={t('pages.server.files.modal.renameFile.form.fileName', {})}
        placeholder={t('pages.server.files.modal.renameFile.form.fileName', {})}
        data-autofocus
        {...form.getInputProps('name')}
      />

      <ModalFooter>
        <Button type='submit' loading={loading}>
          {t('pages.server.files.button.rename', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
