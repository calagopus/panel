import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import reattachNodeBackup from '@/api/admin/nodes/backups/reattachNodeBackup.ts';
import getNodeServers from '@/api/admin/nodes/servers/getNodeServers.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

type Props = ModalProps & {
  node: z.infer<typeof adminNodeSchema>;
  backup: z.infer<typeof adminServerBackupSchema>;
};

export default function NodeBackupsReattachModal({ node, backup, opened, onClose }: Props) {
  const { addToast } = useToast();

  const [selectedServer, setSelectedServer] = useState<z.infer<typeof adminServerSchema> | null>(backup.server ?? null);
  const [loading, setLoading] = useState(false);

  const servers = useSearchableResource<z.infer<typeof adminServerSchema>>({
    fetcher: (search) => (backup.isRemote ? getServers(1, search) : getNodeServers(node.uuid, 1, search)),
  });

  useEffect(() => {
    if (!opened) {
      servers.setSearch('');
      setSelectedServer(backup.server ?? null);
    }
  }, [opened]);

  const doReattach = () => {
    if (!selectedServer) {
      return;
    }

    setLoading(true);

    reattachNodeBackup(node.uuid, backup.uuid, { serverUuid: selectedServer.uuid })
      .then(() => {
        backup.server = selectedServer;
        onClose();
        addToast(`Reattached backup to ${selectedServer.name} successfully.`, 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Reattach Node Backup' onClose={onClose} opened={opened}>
      <Stack>
        <p>
          Reattaching a node backup will link it to a server. This is useful if the backup is detached or you want to
          link it to a different server. Do note that this is not a transfer tool, unless the backup is considered
          remote (can be accessed by multiple nodes), the server must belong to the same node as the backup.
        </p>

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
      </Stack>

      <ModalFooter>
        <Button
          color='red'
          onClick={doReattach}
          loading={loading}
          disabled={selectedServer?.uuid === backup.server?.uuid}
        >
          Reattach
        </Button>
        <Button variant='default' onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
