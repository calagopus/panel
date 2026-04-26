import { ModalProps, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getNodes from '@/api/admin/nodes/getNodes.ts';
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

export default function MountAddNodeModal({
  mount,
  refetch,
  opened,
  onClose,
}: ModalProps & { mount: z.infer<typeof adminMountSchema>; refetch: () => void }) {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<z.infer<typeof adminNodeSchema> | null>(null);

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.mounts.all(),
    fetcher: (search) => getNodes(1, search),
  });

  useEffect(() => {
    if (!opened) {
      nodes.setSearch('');
      setSelectedNode(null);
    }
  }, [opened]);

  const doAdd = () => {
    if (!selectedNode) {
      return;
    }

    setLoading(true);

    createNodeMount(selectedNode.uuid, mount.uuid)
      .then(() => {
        addToast('Mount Node added.', 'success');

        onClose();
        refetch();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Add Mount Node' onClose={onClose} opened={opened}>
      <Stack>
        <Select
          withAsterisk
          label='Node'
          placeholder='Node'
          value={selectedNode?.uuid}
          onChange={(value) => setSelectedNode(nodes.items.find((n) => n.uuid === value) ?? null)}
          data={nodes.items.map((node) => ({
            label: node.name,
            value: node.uuid,
          }))}
          searchable
          searchValue={nodes.search}
          onSearchChange={nodes.setSearch}
          loading={nodes.loading}
        />

        <ModalFooter>
          <Button onClick={doAdd} loading={loading} disabled={!selectedNode}>
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
