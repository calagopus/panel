import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useEffect } from 'react';
import { z } from 'zod';
import decompressFile from '@/api/server/files/decompressFile.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import DirectoryBrowser from '@/elements/DirectoryBrowser.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { serverDirectoryEntrySchema, serverFilesExtractSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  file: z.infer<typeof serverDirectoryEntrySchema> | null;
};

export default function FileExtractModal({ file, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);
  const canCreate = useServerCan('files.create');

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverFilesExtractSchema>>({
    initialValues: {
      destination: browsingDirectory,
    },
    validate: zod4Resolver(serverFilesExtractSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      if (!file) return;
      await decompressFile(server.uuid, values.destination, join(browsingDirectory, file.name));
      doSelectFiles([]);
      addToast(t('pages.server.files.toast.decompressionStarted', {}), 'success');
    },
  });

  useEffect(() => {
    if (props.opened) {
      form.setValues({ destination: browsingDirectory });
      form.resetDirty();
    }
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.server.files.modal.extractFile.title', {})}
      isDirty={isDirty}
      loading={loading}
      size='lg'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <DirectoryBrowser
          serverUuid={server.uuid}
          path={form.values.destination}
          onNavigate={(path) => form.setFieldValue('destination', path)}
          withCreateDirectory={canCreate}
        />

        <TextInput label={t('common.form.destinationDirectory', {})} {...form.getInputProps('destination')} />
      </Stack>

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.extractFile.extractedTo', { file: file?.name ?? '' })}</span>
        <Code>
          /home/container/
          <span className='text-cyan-200'>{form.values.destination.replace(/^(\.\.\/|\/)+/, '')}</span>
        </Code>
      </p>

      <ModalFooter>
        <Button type='submit' loading={loading}>
          {t('pages.server.files.button.extract', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
