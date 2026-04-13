import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import copyFile from '@/api/server/files/copyFile.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDirectoryEntrySchema, serverFilesCopySchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

export default function FileCopyModal({ file, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { browsingDirectory, browsingEntries } = useFileManager();

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverFilesCopySchema>>(
    {
      initialValues: {
        name: '',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverFilesCopySchema),
    },
    onClose,
  );

  useEffect(() => {
    if (file) {
      form.setValues({
        name: file.name,
      });
    }
  }, [file]);

  const generateNewName = () => {
    if (!file) return '';

    const lastDotIndex = file.name.lastIndexOf('.');
    let extension = lastDotIndex > -1 ? file.name.slice(lastDotIndex) : '';
    let baseName = lastDotIndex > -1 ? file.name.slice(0, lastDotIndex) : file.name;

    if (baseName.endsWith('.tar')) {
      extension = '.tar' + extension;
      baseName = baseName.slice(0, -4);
    }

    const lastSlashIndex = file.name.lastIndexOf('/');
    const parent = lastSlashIndex > -1 ? file.name.slice(0, lastSlashIndex + 1) : '';

    let suffix = ' copy';

    for (let i = 0; i <= 50; i++) {
      if (i > 0) {
        suffix = ` copy ${i}`;
      }

      const newName = baseName.concat(suffix, extension);
      const newPath = parent + newName;

      const exists = browsingEntries.data.some((entry) => entry.name === newPath);

      if (!exists) {
        return newName;
      }

      if (i === 50) {
        const timestamp = new Date().toISOString();
        suffix = `copy.${timestamp}`;

        const finalName = baseName.concat(suffix, extension);
        return finalName;
      }
    }

    return baseName.concat(suffix, extension);
  };

  const doCopy = () => {
    if (!file) return;

    setLoading(true);

    copyFile(server.uuid, join(browsingDirectory, file.name), form.values.name || null)
      .then(() => {
        addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
        handleClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.modal.copyFile.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => doCopy())}>
        <TextInput
          label={t('pages.server.files.modal.copyFile.form.fileName', {})}
          placeholder={t('pages.server.files.modal.copyFile.form.fileName', {})}
          data-autofocus
          {...form.getInputProps('name')}
        />

        <p className='mt-2 text-sm md:text-base break-all'>
          <span className='text-neutral-200'>{t('pages.server.files.modal.copyFile.createdAs', {})}</span>
          <Code>
            /home/container/
            <span className='text-cyan-200'>
              {join(browsingDirectory, form.getValues().name || generateNewName()).replace(/^(\.\.\/|\/)+/, '')}
            </span>
          </Code>
        </p>

        <ModalFooter>
          <Button type='submit' loading={loading}>
            {t('pages.server.files.button.copy', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
