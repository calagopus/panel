import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import createNodeMount from '@/api/admin/nodes/mounts/createNodeMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function MountAddNodeModal({
  mount,
  ...props
}: ModalProps & { mount: z.infer<typeof adminMountSchema> }) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<z.infer<typeof adminNodeSchema> | null>(null);

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
  });

  useEffect(() => {
    if (!props.opened) {
      nodes.setSearch('');
      setSelectedNode(null);
    }
  }, [props.opened]);

  const doAdd = () => {
    if (!selectedNode) {
      return;
    }

    setLoading(true);

    createNodeMount(selectedNode.uuid, mount.uuid)
      .then(() => {
        addToast(t('pages.admin.mounts.tabs.nodes.page.toast.added', {}), 'success');

        props.onClose();

        queryClient.invalidateQueries({ queryKey: queryKeys.admin.mountAssignments.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.mounts.tabs.nodes.page.modal.add.title', {})} {...props}>
      <Stack>
        <Select
          withAsterisk
          label={t('common.form.node', {})}
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
            {t('common.button.add', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
