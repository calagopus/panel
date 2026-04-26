import { faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import debounce from 'debounce';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteAllocation from '@/api/server/allocations/deleteAllocation.ts';
import updateAllocation from '@/api/server/allocations/updateAllocation.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function AllocationRow({ allocation }: { allocation: z.infer<typeof serverAllocationSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, allocations, removeAllocation, setAllocations, updateServer } = useServerStore();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);
  const [notes, setNotes] = useState(allocation.notes ?? '');
  const canUpdate = useServerCan('allocations.update');

  useEffect(() => {
    if (notes !== (allocation.notes ?? '')) {
      setDebouncedNotes(notes);
    }
  }, [notes]);

  const setDebouncedNotes = useCallback(
    debounce((notes: string) => {
      updateAllocation(server.uuid, allocation.uuid, { notes: notes || null })
        .then(() => {
          addToast(t('pages.server.network.toast.updated', {}), 'success');
          allocation.notes = notes;
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        });
    }, 500),
    [],
  );

  const doSetPrimary = () => {
    updateAllocation(server.uuid, allocation.uuid, { primary: true })
      .then(() => {
        setAllocations({
          ...allocations,
          data: allocations.data.map((a) => ({
            ...a,
            isPrimary: a.uuid === allocation.uuid,
          })),
        });
        updateServer({ allocation });
        addToast(t('pages.server.network.toast.setPrimary', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doUnsetPrimary = () => {
    updateAllocation(server.uuid, allocation.uuid, { primary: false })
      .then(() => {
        setAllocations({
          ...allocations,
          data: allocations.data.map((a) => ({
            ...a,
            isPrimary: false,
          })),
        });
        updateServer({ allocation: null });
        addToast(t('pages.server.network.toast.unsetPrimary', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doRemove = async () => {
    await deleteAllocation(server.uuid, allocation.uuid)
      .then(() => {
        removeAllocation(allocation);
        addToast(t('pages.server.network.toast.removed', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.network.modal.removeAllocation.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.server.network.modal.removeAllocation.content', {
          allocation: `${allocation.ipAlias ?? allocation.ip}:${allocation.port}`,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faStar,
            label: t('pages.server.network.button.setPrimary', {}),
            hidden: allocation.isPrimary,
            onClick: doSetPrimary,
            color: 'gray',
            canAccess: canUpdate,
          },
          {
            icon: faStar,
            label: t('pages.server.network.button.unsetPrimary', {}),
            hidden: !allocation.isPrimary,
            onClick: doUnsetPrimary,
            color: 'red',
            canAccess: canUpdate,
          },
          {
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useServerCan('allocations.delete'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.server.network.allocationContextMenu}
        registryProps={{ allocation }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <td className='relative w-10 text-center'>
              {allocation.isPrimary && (
                <Tooltip label={t('pages.server.network.tooltip.primary', {})}>
                  <FontAwesomeIcon icon={faStar} className='text-yellow-500 ml-3' />
                </Tooltip>
              )}
            </td>

            <TableData>
              <Code>{allocation.ipAlias ?? allocation.ip}</Code>
            </TableData>

            <TableData>
              <Code>{allocation.port}</Code>
            </TableData>

            <TableData>
              <TextArea
                rows={Math.min(3, notes.split('\n').length)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('pages.server.network.table.columns.notes', {})}
                disabled={!canUpdate}
              />
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={allocation.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
