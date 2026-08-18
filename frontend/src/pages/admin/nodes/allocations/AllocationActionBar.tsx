import { faPen, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import deleteNodeAllocations from '@/api/admin/nodes/allocations/deleteNodeAllocations.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminNodeAllocationFilterSchema,
  adminNodeAllocationSchema,
  adminNodeAllocationSelectorSchema,
  adminNodeSchema,
} from '@/lib/schemas/admin/nodes.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeAllocationsUpdateModal from './modals/NodeAllocationsUpdateModal.tsx';

export default function AllocationActionBar({
  node,
  loadAllocations,
  selectedNodeAllocations,
  clearSelection,
  filter,
  filterIsEmpty,
  matchingTotal,
  selectedAllMatching,
}: {
  node: z.infer<typeof adminNodeSchema>;
  loadAllocations: () => void;
  selectedNodeAllocations: ObjectSet<z.infer<typeof adminNodeAllocationSchema>, 'uuid'>;
  clearSelection: () => void;
  filter: z.infer<typeof adminNodeAllocationFilterSchema>;
  filterIsEmpty: boolean;
  matchingTotal: number;
  selectedAllMatching: boolean;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'update' | 'delete' | null>(null);
  const [force, setForce] = useState(false);

  const selector = useMemo<z.infer<typeof adminNodeAllocationSelectorSchema>>(() => {
    if (!selectedAllMatching) {
      return { type: 'uuids', uuids: [...selectedNodeAllocations.keys()] };
    }

    return filterIsEmpty ? { type: 'all' } : { type: 'filter', filter };
  }, [selectedAllMatching, selectedNodeAllocations, filterIsEmpty, filter]);

  const affectedCount = selectedAllMatching ? matchingTotal : selectedNodeAllocations.size;

  const doDelete = async () => {
    await deleteNodeAllocations(node.uuid, selector, force)
      .then(({ deleted, skipped }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.allocations(node.uuid) });
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.allocationIps(node.uuid) });

        if (skipped > 0) {
          addToast(
            t('pages.admin.nodes.tabs.allocations.page.modal.delete.toast.deletedPartial', {
              allocations: tItem('allocation', deleted),
              skipped,
            }),
            'warning',
          );
        } else {
          addToast(
            t('pages.admin.nodes.tabs.allocations.page.modal.delete.toast.deleted', {
              allocations: tItem('allocation', deleted),
            }),
            'success',
          );
        }

        clearSelection();
        setForce(false);
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
        callback: () => {
          if (affectedCount === 0) return;
          setOpenModal('delete');
        },
      },
    ],
    deps: [affectedCount],
  });

  return (
    <>
      <NodeAllocationsUpdateModal
        node={node}
        loadAllocations={loadAllocations}
        selectedNodeAllocations={selectedNodeAllocations}
        clearSelection={clearSelection}
        selector={selector}
        affectedCount={affectedCount}
        opened={openModal === 'update'}
        onClose={() => setOpenModal(null)}
      />
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => {
          setForce(false);
          setOpenModal(null);
        }}
        title={t('pages.admin.nodes.tabs.allocations.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('pages.admin.nodes.tabs.allocations.page.modal.delete.content', {
            allocations: tItem('allocation', affectedCount),
            name: node.name,
          }).md()}

          <Switch
            label={t('common.form.force', {})}
            name='force'
            color='red'
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />

          {force && (
            <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.admin.nodes.tabs.allocations.page.modal.delete.alert.forceWarning', {})}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <ActionBar opened={affectedCount > 0}>
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
