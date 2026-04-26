import { ModalProps, Stack, Switch } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import restoreNodeBackup from '@/api/admin/nodes/backups/restoreNodeBackup.ts';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

type Props = ModalProps & {
  node: z.infer<typeof adminNodeSchema>;
  backup: z.infer<typeof adminServerBackupSchema>;
};

export default function NodeBackupsRestoreModal({ node, backup, opened, onClose }: Props) {
  const { addToast } = useToast();

  const [truncate, setTruncate] = useState(false);
  const [selectedServer, setSelectedServer] = useState<z.infer<typeof adminServerSchema> | null>(null);
  const [loading, setLoading] = useState(false);

  const servers = useSearchableResource<z.infer<typeof adminServerSchema>>({
    queryKey: backup.isRemote ? queryKeys.admin.servers.all() : queryKeys.admin.nodes.servers(node.uuid),
    fetcher: (search) => (backup.isRemote ? getServers(1, search) : getNodeServers(node.uuid, 1, search)),
  });

  useEffect(() => {
    if (!opened) {
      servers.setSearch('');
      setSelectedServer(null);
    }
  }, [opened]);

  const doRestore = () => {
    if (!selectedServer) {
      return;
    }

    setLoading(true);

    restoreNodeBackup(node.uuid, backup.uuid, { serverUuid: selectedServer.uuid, truncateDirectory: truncate })
      .then(() => {
        onClose();
        addToast(`Restoring backup to ${selectedServer.name}...`, 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Restore Node Backup' onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label='Server'
          placeholder='Server'
          value={selectedServer?.uuid}
          onChange={(value) => setSelectedServer(servers.items.find((m) => m.uuid === value) ?? null)}
          data={servers.items.map((server) => ({
            label: server.name,
            value: server.uuid,
          }))}
          searchable
          searchValue={servers.search}
          onSearchChange={servers.setSearch}
          loading={servers.loading}
        />

        <Switch
          label='Do you want to empty the filesystem of this server before restoring the backup?'
          name='truncate'
          checked={truncate}
          onChange={(e) => setTruncate(e.target.checked)}
        />
      </Stack>

      <ModalFooter>
        <Button color={truncate ? 'red' : undefined} onClick={doRestore} loading={loading}>
          Restore
        </Button>
        <Button variant='default' onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
