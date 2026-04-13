import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createDirectory from '@/api/server/files/createDirectory.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverFilesDirectoryCreateSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DirectoryNameModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const [_, setSearchParams] = useSearchParams();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { browsingDirectory } = useFileManager();

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverFilesDirectoryCreateSchema>>(
    {
      initialValues: {
        name: '',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverFilesDirectoryCreateSchema),
    },
    onClose,
  );

  const makeDirectory = () => {
    setLoading(true);

    createDirectory(server.uuid, browsingDirectory, form.values.name)
      .then(() => {
        handleClose();
        setSearchParams({ directory: join(browsingDirectory, form.values.name) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.modal.createDirectory.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => makeDirectory())}>
        <TextInput
          withAsterisk
          label={t('pages.server.files.modal.createDirectory.form.directoryName', {})}
          placeholder={t('pages.server.files.modal.createDirectory.form.directoryName', {})}
          data-autofocus
          {...form.getInputProps('name')}
        />

        <p className='mt-2 text-sm md:text-base break-all'>
          <span className='text-neutral-200'>{t('pages.server.files.modal.createDirectory.createdAs', {})}</span>
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
      </form>
    </Modal>
  );
}
