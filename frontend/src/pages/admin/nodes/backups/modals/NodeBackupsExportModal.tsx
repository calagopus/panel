import { ModalProps } from '@mantine/core';
import { join } from 'pathe';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import exportNodeBackup from '@/api/admin/nodes/backups/exportNodeBackup.ts';
import queryNodeBackup from '@/api/admin/nodes/backups/queryNodeBackup.ts';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import DirectoryBrowser from '@/elements/DirectoryBrowser.tsx';
import Select from '@/elements/input/Select.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { archiveFormatLabelMapping, streamingArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { archiveFormat } from '@/lib/schemas/server/files.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  node: z.infer<typeof adminNodeSchema>;
  backup: z.infer<typeof adminServerBackupSchema>;
};

export default function NodeBackupsExportModal({ node, backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [selectedServer, setSelectedServer] = useState<z.infer<typeof adminServerSchema> | null>(null);
  const [directory, setDirectory] = useState('/');
  const [name, setName] = useState(backup.name);
  const [format, setFormat] = useState<z.infer<typeof streamingArchiveFormat>>('tar_gz');
  const [forcedFormat, setForcedFormat] = useState<z.infer<typeof archiveFormat> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened) {
      setSelectedServer(null);
      setDirectory('/');
      setName(backup.name);
      setFormat('tar_gz');
      setForcedFormat(null);
      return;
    }

    queryNodeBackup(node.uuid, backup.uuid)
      .then((query) => setForcedFormat(query.archiveFormat))
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  }, [props.opened, backup.uuid, backup.name, node.uuid]);

  const extension = useMemo(
    () => (forcedFormat ? archiveFormatLabelMapping[forcedFormat] : streamingArchiveFormatLabelMapping[format]),
    [forcedFormat, format],
  );

  const doExport = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedServer) {
      return;
    }

    setLoading(true);

    exportNodeBackup(node.uuid, backup.uuid, {
      serverUuid: selectedServer.uuid,
      path: join(directory, `${name}${extension}`),
      archiveFormat: format,
      foreground: false,
    })
      .then(() => {
        props.onClose();
        addToast(t('pages.admin.nodes.tabs.backups.page.toast.exporting', { name: selectedServer.name }), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('pages.admin.nodes.tabs.backups.page.modal.export.title', {})}
      size='lg'
      loading={loading}
      {...props}
      onSubmit={doExport}
    >
      <Stack>
        <ServerSelect<z.infer<typeof adminServerSchema>>
          withAsterisk
          label={t('common.table.columns.server', {})}
          placeholder={t('common.table.columns.server', {})}
          queryKey={backup.isShared ? queryKeys.admin.servers.all() : queryKeys.admin.nodes.servers(node.uuid)}
          fetcher={(search) => (backup.isShared ? getServers(1, search) : getNodeServers(node.uuid, 1, search))}
          value={selectedServer?.uuid ?? null}
          selectedItem={selectedServer}
          onChange={(_, server) => setSelectedServer(server)}
        />

        {selectedServer && (
          <DirectoryBrowser
            serverUuid={selectedServer.uuid}
            path={directory}
            onNavigate={setDirectory}
            withCreateDirectory
          />
        )}

        <TextInput
          label={t('common.form.destinationDirectory', {})}
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
        />

        <div className='grid grid-cols-4 items-end gap-2'>
          <TextInput
            label={t('common.form.fileName', {})}
            className='col-span-3'
            value={name}
            onChange={(e) => setName(e.target.value)}
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
              value={format}
              onChange={(value) => setFormat(value as z.infer<typeof streamingArchiveFormat>)}
              data={Object.entries(streamingArchiveFormatLabelMapping).map(([f, ext]) => ({
                label: ext,
                value: f,
              }))}
            />
          )}
        </div>
      </Stack>

      <p className='mt-2 text-sm md:text-base break-all'>
        <span>{t('pages.server.files.modal.createArchive.createdAs', {})}</span>
        <Code>
          /home/container/
          <span className='text-cyan-200'>{join(directory, `${name}${extension}`).replace(/^(\.\.\/|\/)+/, '')}</span>
        </Code>
      </p>

      <ModalFooter>
        <Button type='submit' loading={loading} disabled={!selectedServer}>
          {t('common.button.export', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
