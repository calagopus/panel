import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getMounts from '@/api/admin/mounts/getMounts.ts';
import createNodeMount from '@/api/admin/nodes/mounts/createNodeMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function NodeMountAddModal({
  node,
  opened,
  onClose,
}: ModalProps & { node: z.infer<typeof adminNodeSchema> }) {
  const { addToast } = useToast();
  const { addNodeMount } = useAdminStore();

  const [loading, setLoading] = useState(false);
  const [selectedMount, setSelectedMount] = useState<z.infer<typeof adminMountSchema> | null>(null);

  const mounts = useSearchableResource<z.infer<typeof adminMountSchema>>({
    queryKey: queryKeys.admin.mounts.all(),
    fetcher: (search) => getMounts(1, search),
  });

  useEffect(() => {
    if (!opened) {
      mounts.setSearch('');
      setSelectedMount(null);
    }
  }, [opened]);

  const doAdd = () => {
    if (!selectedMount) {
      return;
    }

    setLoading(true);

    createNodeMount(node.uuid, selectedMount.uuid)
      .then(() => {
        addToast('Node Mount added.', 'success');

        onClose();
        addNodeMount({ mount: selectedMount, created: new Date() });
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
          value={selectedMount?.uuid}
          onChange={(value) => setSelectedMount(mounts.items.find((m) => m.uuid === value) ?? null)}
          data={mounts.items.map((mount) => ({
            label: mount.name,
            value: mount.uuid,
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
