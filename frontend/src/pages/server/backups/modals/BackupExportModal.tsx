import { faFolder } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Anchor, ModalProps } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { join } from 'pathe';
import { useEffect, useMemo, useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import exportBackup from '@/api/server/backups/exportBackup.ts';
import queryBackup from '@/api/server/backups/queryBackup.ts';
import loadDirectory from '@/api/server/files/loadDirectory.ts';
import Breadcrumbs from '@/elements/Breadcrumbs.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import { archiveFormatLabelMapping, streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { archiveFormat } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

function DirectoryBrowser({
  serverUuid,
  path,
  onNavigate,
}: {
  serverUuid: string;
  path: string;
  onNavigate: (path: string) => void;
}) {
  const { t } = useTranslations();
  const { data, isLoading } = useQuery({
    queryKey: ['backup-export-browser', serverUuid, path],
    queryFn: () => loadDirectory(serverUuid, path, 1, 'name_asc'),
  });

  const pathSegments = path.split('/').filter(Boolean);

  return (
    <div className='border border-(--mantine-color-default-border) rounded-md overflow-hidden'>
      <div className='px-3 py-2 border-b border-(--mantine-color-default-border) bg-(--mantine-color-body)'>
        <Breadcrumbs separatorMargin='xs'>
          <Anchor component='button' type='button' size='sm' onClick={() => onNavigate('/')}>
            container
          </Anchor>
          {pathSegments.map((seg, i) => {
            const segPath = '/' + pathSegments.slice(0, i + 1).join('/');
            const isLast = i === pathSegments.length - 1;
            return isLast ? (
              <span key={segPath} className='text-sm'>
                {seg}
              </span>
            ) : (
              <Anchor component='button' type='button' key={segPath} size='sm' onClick={() => onNavigate(segPath)}>
                {seg}
              </Anchor>
            );
          })}
        </Breadcrumbs>
      </div>

      <div className='overflow-y-auto max-h-52 bg-(--mantine-color-default)'>
        {isLoading ? (
          <Spinner.Centered size={20} />
        ) : !data || data.entries.data.filter((e) => e.directory).length === 0 ? (
          <p className='text-sm text-(--mantine-color-dimmed) px-3 py-2'>{t('common.label.noSubdirectories', {})}</p>
        ) : (
          data.entries.data
            .filter((entry) => entry.directory)
            .map((entry) => (
              <button
                key={entry.name}
                type='button'
                onClick={() => onNavigate(join(path, entry.name))}
                className='w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left hover:bg-(--mantine-color-default-hover)'
              >
                <FontAwesomeIcon icon={faFolder} className='text-(--mantine-color-dimmed)' />
                <span className='truncate'>{entry.name}</span>
              </button>
            ))
        )}
      </div>
    </div>
  );
}

type Props = ModalProps & {
  backup: z.infer<typeof serverBackupSchema>;
};

export default function BackupExportModal({ backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const navigate = useNavigate();

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
