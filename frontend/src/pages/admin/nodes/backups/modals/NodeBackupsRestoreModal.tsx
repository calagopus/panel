import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import restoreNodeBackup from '@/api/admin/nodes/backups/restoreNodeBackup.ts';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  node: z.infer<typeof adminNodeSchema>;
  backup: z.infer<typeof adminServerBackupSchema>;
};

export default function NodeBackupsRestoreModal({ node, backup, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [truncateDirectory, setTruncateDirectory] = useState(false);
  const [restoreStartup, setRestoreStartup] = useState(false);
  const [selectedServer, setSelectedServer] = useState<z.infer<typeof adminServerSchema> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened) {
      setSelectedServer(null);
    }
  }, [props.opened]);

  const doRestore = () => {
    if (!selectedServer) {
      return;
    }

    setLoading(true);

    restoreNodeBackup(node.uuid, backup.uuid, { serverUuid: selectedServer.uuid, truncateDirectory, restoreStartup })
      .then(() => {
        props.onClose();
        addToast(t('pages.admin.nodes.tabs.backups.page.toast.restoring', { name: selectedServer.name }), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.nodes.tabs.backups.page.modal.restore.title', {})} {...props}>
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

        <Switch
          label={t('pages.admin.nodes.tabs.backups.page.modal.restore.form.truncateDirectory', {})}
          name='truncateDirectory'
          checked={truncateDirectory}
          onChange={(e) => setTruncateDirectory(e.target.checked)}
        />

        <Switch
          label={t('common.form.restoreStartup', {})}
          name='restoreStartup'
          checked={restoreStartup}
          disabled={Object.keys(backup.metadata).length === 0}
          onChange={(e) => setRestoreStartup(e.target.checked)}
        />
      </Stack>

      <ModalFooter>
        <Button color={truncateDirectory ? 'red' : undefined} onClick={doRestore} loading={loading}>
          {t('common.button.restore', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
