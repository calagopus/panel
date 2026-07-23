import { ModalProps } from '@mantine/core';
import { join } from 'pathe';
import { useEffect, useMemo, useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import exportBackup from '@/api/server/backups/exportBackup.ts';
import queryBackup from '@/api/server/backups/queryBackup.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import DirectoryBrowser from '@/elements/DirectoryBrowser.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { archiveFormatLabelMapping, streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { archiveFormat } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  backup: z.infer<typeof serverBackupSchema>;
};

export default function BackupExportModal({ backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const navigate = useNavigate();
  const canCreate = useServerCan('files.create');

  const [forcedFormat, setForcedFormat] = useState<z.infer<typeof archiveFormat> | null>(null);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<{
    directory: string;
    name: string;
    format: z.infer<typeof streamingArchiveFormat>;
  }>({
    initialValues: {
      directory: '/',
      name: backup.name,
      format: 'tar_gz',
    },
    onClose: props.onClose,
    onSubmit: async (values) => {
      await exportBackup(server.uuid, backup.uuid, {
        path: join(values.directory, `${values.name}${extension}`),
        archiveFormat: values.format,
        foreground: false,
      });
      addToast(t('pages.server.backups.toast.exportStarted', {}), 'success');

      navigate(
        `/server/${server.uuidShort}/files?${createSearchParams({
          directory: values.directory,
        })}`,
      );
    },
  });

  useEffect(() => {
    if (!props.opened) {
      setForcedFormat(null);
      return;
    }

    queryBackup(server.uuid, backup.uuid)
      .then((query) => setForcedFormat(query.archiveFormat))
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  }, [props.opened, backup.uuid, server.uuid]);

  const extension = useMemo(
    () =>
      forcedFormat ? archiveFormatLabelMapping[forcedFormat] : streamingArchiveFormatLabelMapping[form.values.format],
    [forcedFormat, form.values.format],
  );

  return (
    <FormModal
      title={t('pages.server.backups.modal.exportBackup.title', {})}
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
          path={form.values.directory}
          onNavigate={(path) => form.setFieldValue('directory', path)}
          withCreateDirectory={canCreate}
        />

        <TextInput label={t('common.form.destinationDirectory', {})} {...form.getInputProps('directory')} />

        <div className='grid grid-cols-4 items-end gap-2'>
          <TextInput
            label={t('common.form.fileName', {})}
            data-autofocus
            className='col-span-3'
            {...form.getInputProps('name')}
          />
          {forcedFormat ? (
            <Select
              disabled
              label={t('pages.server.files.modal.createArchive.form.format', {})}
              className='col-span-1'
              value={forcedFormat}
              data={[{ label: archiveFormatLabelMapping[forcedFormat], value: forcedFormat }]}
            />
          ) : (
            <Select
              withAsterisk
              label={t('pages.server.files.modal.createArchive.form.format', {})}
              className='col-span-1'
              data={Object.entries(streamingArchiveFormatLabelMapping).map(([format, ext]) => ({
                label: ext,
                value: format,
              }))}
              {...form.getInputProps('format')}
            />
          )}
        </div>
      </Stack>

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.createArchive.createdAs', {})}</span>
        <Code>
          /home/container/
          <span className='text-cyan-200'>
            {join(form.values.directory, `${form.values.name}${extension}`).replace(/^(\.\.\/|\/)+/, '')}
          </span>
        </Code>
      </p>

      <ModalFooter>
        <Button type='submit' loading={loading}>
          {t('common.button.export', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
