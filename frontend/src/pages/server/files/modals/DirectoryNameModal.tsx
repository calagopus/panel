import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import createDirectory from '@/api/server/files/createDirectory.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverFilesDirectoryCreateSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DirectoryNameModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const [_, setSearchParams] = useSearchParams();
  const { server } = useServerStore();
  const { browsingDirectory } = useFileManager();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverFilesDirectoryCreateSchema>
  >({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(serverFilesDirectoryCreateSchema),
    onClose,
    onSubmit: async (values) => {
      await createDirectory(server.uuid, browsingDirectory, values.name);
      setSearchParams({ directory: join(browsingDirectory, values.name) });
    },
  });

  return (
    <FormModal
      title={t('pages.server.files.modal.createDirectory.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
      <TextInput
        withAsterisk
        label={t('pages.server.files.modal.createDirectory.form.directoryName', {})}
        placeholder={t('pages.server.files.modal.createDirectory.form.directoryName', {})}
        data-autofocus
        {...form.getInputProps('name')}
      />

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.createDirectory.createdAs', {})}</span>
        <Code>
          /home/container/
          <span className='text-cyan-200'>
            {join(browsingDirectory, form.values.name).replace(/^(\.\.\/|\/)+/, '')}
          </span>
        </Code>
      </p>

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
