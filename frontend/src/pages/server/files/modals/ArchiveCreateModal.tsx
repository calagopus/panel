import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { z } from 'zod';
import compressFiles from '@/api/server/files/compressFiles.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { archiveFormatLabelMapping } from '@/lib/enums.ts';
import { generateArchiveName } from '@/lib/files.ts';
import {
  archiveFormat,
  serverDirectoryEntrySchema,
  serverFilesArchiveCreateSchema,
} from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
};

export default function ArchiveCreateModal({ files, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const doSelectFiles = useFileManager((state) => state.doSelectFiles);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof serverFilesArchiveCreateSchema>
  >({
    initialValues: {
      name: '',
      format: 'tar_gz',
    },
    validate: zod4Resolver(serverFilesArchiveCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      await compressFiles(server.uuid, {
        name: values.name
          ? values.name.concat(archiveFormatLabelMapping[values.format as z.infer<typeof archiveFormat>])
          : generateArchiveName(archiveFormatLabelMapping[values.format as z.infer<typeof archiveFormat>]),
        format: values.format,
        root: browsingDirectory,
        files: files.map((f) => f.name),
      });
      doSelectFiles([]);
      addToast(t('pages.server.files.toast.archiveCreationStarted', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.server.files.modal.createArchive.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput label={t('common.form.archiveName', {})} data-autofocus {...form.getInputProps('name')} />

        <Select
          withAsterisk
          label={t('pages.server.files.modal.createArchive.form.format', {})}
          data={Object.entries(archiveFormatLabelMapping).map(([format, extension]) => ({
            label: extension,
            value: format,
          }))}
          {...form.getInputProps('format')}
        />

        <p className='text-sm md:text-base break-all'>
          <span>{t('pages.server.files.modal.createArchive.createdAs', {})}</span>
          <Code>
            /home/container/
            <span className='text-cyan-200'>
              {join(
                browsingDirectory,
                form.values.name
                  ? `${form.values.name}${archiveFormatLabelMapping[form.values.format as z.infer<typeof archiveFormat>]}`
                  : generateArchiveName(archiveFormatLabelMapping[form.values.format as z.infer<typeof archiveFormat>]),
              ).replace(/^(\.\.\/|\/)+/, '')}
            </span>
          </Code>
        </p>

        <ModalFooter>
          <Button type='submit' loading={loading}>
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
