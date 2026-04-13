import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import compressFiles from '@/api/server/files/compressFiles.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
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

export default function ArchiveCreateModal({ files, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { browsingDirectory, doSelectFiles } = useFileManager();

  const [loading, setLoading] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverFilesArchiveCreateSchema>>(
    {
      initialValues: {
        name: '',
        format: 'tar_gz',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverFilesArchiveCreateSchema),
    },
    onClose,
  );

  const doArchive = () => {
    setLoading(true);

    compressFiles(server.uuid, {
      name: form.values.name
        ? form.values.name.concat(archiveFormatLabelMapping[form.values.format as z.infer<typeof archiveFormat>])
        : generateArchiveName(archiveFormatLabelMapping[form.values.format as z.infer<typeof archiveFormat>]),
      format: form.values.format,
      root: browsingDirectory,
      files: files.map((f) => f.name),
    })
      .then(() => {
        doSelectFiles([]);
        addToast(t('pages.server.files.toast.archiveCreationStarted', {}), 'success');
        handleClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.modal.createArchive.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => doArchive())}>
        <Stack>
          <TextInput
            label={t('pages.server.files.modal.createArchive.form.archiveName', {})}
            placeholder={t('pages.server.files.modal.createArchive.form.archiveName', {})}
            data-autofocus
            {...form.getInputProps('name')}
          />

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
            <span className='text-neutral-200'>{t('pages.server.files.modal.createArchive.createdAs', {})}</span>
            <Code>
              /home/container/
              <span className='text-cyan-200'>
                {join(
                  browsingDirectory,
                  form.values.name
                    ? `${form.values.name}${archiveFormatLabelMapping[form.values.format as z.infer<typeof archiveFormat>]}`
                    : generateArchiveName(
                        archiveFormatLabelMapping[form.values.format as z.infer<typeof archiveFormat>],
                      ),
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
      </form>
    </Modal>
  );
}
