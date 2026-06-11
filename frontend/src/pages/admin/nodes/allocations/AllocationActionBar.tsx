import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteNodeAllocations from '@/api/admin/nodes/allocations/deleteNodeAllocations.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import NodeAllocationsUpdateModal from './modals/NodeAllocationsUpdateModal.tsx';

export default function AllocationActionBar({
  node,
  loadAllocations,
}: {
  node: z.infer<typeof adminNodeSchema>;
  loadAllocations: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const { removeNodeAllocations, selectedNodeAllocations, setSelectedNodeAllocations } = useAdminStore();

  const [openModal, setOpenModal] = useState<'update' | 'delete' | null>(null);

  const doDelete = async () => {
    await deleteNodeAllocations(node.uuid, selectedNodeAllocations.keys())
      .then(({ deleted }) => {
        removeNodeAllocations(selectedNodeAllocations.values());

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
