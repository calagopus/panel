import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createServerMount from '@/api/admin/servers/mounts/createServerMount.ts';
import getAvailableServerMounts from '@/api/admin/servers/mounts/getAvailableServerMounts.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeMountSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerMountSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function ServerMountAddModal({
  server,
  opened,
  onClose,
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { addToast } = useToast();
  const { addServerMount } = useAdminStore();

  const [loading, setLoading] = useState(false);
  const [selectedMount, setSelectedMount] = useState<z.infer<typeof adminNodeMountSchema> | null>(null);

  const mounts = useSearchableResource<z.infer<typeof adminServerMountSchema>>({
    queryKey: queryKeys.admin.servers.mounts(server.uuid),
    fetcher: (search) => getAvailableServerMounts(server.uuid, 1, search),
  });

  useEffect(() => {
    if (!opened) {
      mounts.setSearch('');
      setSelectedMount(null);
    }
  }, [opened]);

  const doAdd = () => {
    if (!selectedMount) return;

    setLoading(true);

    createServerMount(server.uuid, { mountUuid: selectedMount.mount.uuid })
      .then(() => {
        addToast('Node Mount added.', 'success');

        onClose();
        addServerMount({ mount: selectedMount.mount, created: new Date() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Add Node Mount' onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label='Mount'
          placeholder='Mount'
          value={selectedMount?.mount.uuid}
          onChange={(value) => setSelectedMount(mounts.items.find((m) => m.mount.uuid === value) ?? null)}
          data={mounts.items.map((mount) => ({
            label: mount.mount.name,
            value: mount.mount.uuid,
          }))}
          searchable
          searchValue={mounts.search}
          onSearchChange={mounts.setSearch}
          loading={mounts.loading}
        />

        <ModalFooter>
          <Button onClick={doAdd} loading={loading} disabled={!selectedMount}>
            Add
          </Button>
          <Button variant='default' onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
