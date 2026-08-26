import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import renameFiles from '@/api/server/files/renameFiles.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { createUndoAction } from '@/lib/files/undoableFileMutation.ts';
import { serverDirectoryEntrySchema, serverFilesNameSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useUndoableToast } from '@/plugins/useUndoableToast.ts';
import { useFileManager, useFileManagerApi } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { fileManagerUndoScope } from '@/stores/undoHistory.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

export default function FileRenameModal({ file, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addUndoableToast = useUndoableToast(fileManagerUndoScope(server.uuid));
  const store = useFileManagerApi();
  const { browsingDirectory, addSelectedFile, removeSelectedFile, invalidateFilemanager } = useFileManager(
    useShallow((state) => ({
      browsingDirectory: state.browsingDirectory,
      addSelectedFile: state.addSelectedFile,
      removeSelectedFile: state.removeSelectedFile,
      invalidateFilemanager: state.invalidateFilemanager,
    })),
  );

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverFilesNameSchema>>({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(serverFilesNameSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      if (!file) return;

      const oldName = file.name;
      const newName = values.name;
      const directory = browsingDirectory;

      const { renamed } = await renameFiles({
        uuid: server.uuid,
        root: directory,
        files: [
          {
            from: oldName,
            to: newName,
          },
        ],
      });

      if (renamed < 1) {
        addToast(t('pages.server.files.toast.fileCouldNotBeRenamed', {}), 'error');
        return;
      }

      addUndoableToast(
        t('pages.server.files.toast.fileRenamed', {}),
        createUndoAction(
          () =>
            renameFiles({
              uuid: server.uuid,
              root: directory,
              files: [{ from: newName, to: oldName }],
            }),
          (result) => result.renamed,
          {
            addToast,
            invalidateFilemanager,
            cannotUndoMessage: t('pages.server.files.toast.renameCouldNotBeUndone', {}),
            undoneMessage: t('pages.server.files.toast.renameUndone', {}),
            onError: (msg) => addToast(httpErrorToHuman(msg), 'error'),
          },
        ),
      );
      invalidateFilemanager();
      if (store.getState().selectedFiles.has(file)) {
        removeSelectedFile(file);
        addSelectedFile({ ...file, name: newName });
      }
    },
  });

  useEffect(() => {
    if (file && props.opened) {
      const values = { name: file.name };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [file, props.opened]);

  return (
    <FormModal
      title={t('pages.server.files.modal.renameFile.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <TextInput withAsterisk label={t('common.form.fileName', {})} data-autofocus {...form.getInputProps('name')} />

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
