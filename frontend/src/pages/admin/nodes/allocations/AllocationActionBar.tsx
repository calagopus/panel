import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import deleteNodeAllocations from '@/api/admin/nodes/allocations/deleteNodeAllocations.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeAllocationSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeAllocationsUpdateModal from './modals/NodeAllocationsUpdateModal.tsx';

export default function AllocationActionBar({
  node,
  loadAllocations,
  selectedNodeAllocations,
  setSelectedNodeAllocations,
}: {
  node: z.infer<typeof adminNodeSchema>;
  loadAllocations: () => void;
  selectedNodeAllocations: ObjectSet<z.infer<typeof adminNodeAllocationSchema>, 'uuid'>;
  setSelectedNodeAllocations: (allocations: z.infer<typeof adminNodeAllocationSchema>[]) => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'update' | 'delete' | null>(null);

  const doDelete = async () => {
    await deleteNodeAllocations(node.uuid, selectedNodeAllocations.keys())
      .then(({ deleted }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.allocations(node.uuid) });

        addToast(
          t('pages.admin.nodes.tabs.allocations.page.modal.delete.toast.deleted', {
            allocations: tItem('allocation', deleted),
          }),
          'success',
        );
        setSelectedNodeAllocations([]);
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'Delete',
        callback: () => setOpenModal('delete'),
      },
    ],
    deps: [],
  });

  return (
    <>
      <NodeAllocationsUpdateModal
        node={node}
        loadAllocations={loadAllocations}
        selectedNodeAllocations={selectedNodeAllocations}
        setSelectedNodeAllocations={setSelectedNodeAllocations}
        opened={openModal === 'update'}
        onClose={() => setOpenModal(null)}
      />
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nodes.tabs.allocations.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.nodes.tabs.allocations.page.modal.delete.content', {
          count: selectedNodeAllocations.size,
          name: node.name,
        }).md()}
      </ConfirmationModal>

      <ActionBar opened={selectedNodeAllocations.size > 0}>
        <Button onClick={() => setOpenModal('update')}>
          <FontAwesomeIcon icon={faPen} className='mr-2' /> {t('common.button.update', {})}
        </Button>
        <Button color='red' onClick={() => setOpenModal('delete')}>
          <FontAwesomeIcon icon={faTrash} className='mr-2' /> {t('common.button.delete', {})}
        </Button>
      </ActionBar>
    </>
  );
}
