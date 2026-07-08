import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { z } from 'zod';
import copyFile from '@/api/server/files/copyFile.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverDirectoryEntrySchema, serverFilesCopySchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

export default function FileCopyModal({ file, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const browsingEntries = useFileManager((state) => state.browsingEntries);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverFilesCopySchema>>({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(serverFilesCopySchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      if (!file) return;
      await copyFile(server.uuid, join(browsingDirectory, file.name), values.name || null);
      addToast(t('pages.server.files.toast.fileCopyingStarted', {}), 'success');
    },
  });

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

  return (
    <FormModal
      title={t('pages.server.files.modal.copyFile.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <TextInput label={t('common.form.fileName', {})} data-autofocus {...form.getInputProps('name')} />

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.copyFile.createdAs', {})}</span>
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
    </FormModal>
  );
}
