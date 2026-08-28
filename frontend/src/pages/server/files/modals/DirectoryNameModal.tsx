import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import createDirectory from '@/api/server/files/createDirectory.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverFilesDirectoryCreateSchema } from '@/lib/schemas/server/files.ts';
import FilePathPreview from '@/pages/server/files/modals/FilePathPreview.tsx';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DirectoryNameModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const [_, setSearchParams] = useSearchParams();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const invalidateFilemanager = useFileManager((state) => state.invalidateFilemanager);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverFilesDirectoryCreateSchema>
  >({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(serverFilesDirectoryCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createDirectory(server.uuid, browsingDirectory, values.name);
      invalidateFilemanager();
      setSearchParams({ directory: join(browsingDirectory, values.name) });
    },
  });

  return (
    <FormModal
      title={t('pages.server.files.modal.createDirectory.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <TextInput
        withAsterisk
        label={t('common.form.directoryName', {})}
        data-autofocus
        {...form.getInputProps('name')}
      />

      <FilePathPreview
        label={t('pages.server.files.modal.createDirectory.createdAs', {})}
        path={join(browsingDirectory, form.values.name)}
      />

      <ModalFooter>
        <Button type='submit' loading={loading} disabled={!form.isValid()}>
          {t('common.button.create', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
