import { faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import debounce from 'debounce';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteAllocation from '@/api/server/allocations/deleteAllocation.ts';
import updateAllocation from '@/api/server/allocations/updateAllocation.ts';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { patchPaginatedItems, removePaginatedItems } from '@/lib/queryCache.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { useRedactedAddress } from '@/plugins/privacy/useRedactAddresses.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

interface AllocationRowProps {
  allocation: z.infer<typeof serverAllocationSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const AllocationRow = forwardRef<HTMLTableRowElement, AllocationRowProps>(function AllocationRow(
  { allocation, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, updateServer } = useServerStore(
    useShallow((state) => ({
      server: state.server,
      updateServer: state.updateServer,
    })),
  );
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);
  const displayAllocation = useRedactedAddress(`${allocation.ipAlias ?? allocation.ip}:${allocation.port}`);
  const [notes, setNotes] = useState(allocation.notes ?? '');
  const canUpdate = useServerCan('allocations.update');
  const canUnsetPrimary = !server.eggConfiguration?.allocationSelfAssignRequirePrimary;

  const patchAllocations = (
    patch: (item: z.infer<typeof serverAllocationSchema>) => z.infer<typeof serverAllocationSchema>,
  ) => patchPaginatedItems(queryClient, queryKeys.server(server.uuid).network.all(), patch);

  const setDebouncedNotes = useMemo(
    () =>
      debounce((notes: string) => {
        updateAllocation(server.uuid, allocation.uuid, { notes: notes || null })
          .then(() => {
            addToast(t('pages.server.network.toast.updated', {}), 'success');
            patchAllocations((item) => (item.uuid === allocation.uuid ? { ...item, notes: notes || null } : item));
          })
          .catch((msg) => {
            addToast(httpErrorToHuman(msg), 'error');
          });
      }, 500),
    [server.uuid, allocation.uuid, t, addToast, queryClient],
  );

  useEffect(() => {
    if (notes !== (allocation.notes ?? '')) {
      setDebouncedNotes(notes);
    }
  }, [notes]);

  const doSetPrimary = () =>
    updateAllocation(server.uuid, allocation.uuid, { primary: true })
      .then(() => {
        patchAllocations((item) => ({ ...item, isPrimary: item.uuid === allocation.uuid }));
        updateServer({ allocation });
        addToast(t('pages.server.network.toast.setPrimary', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  const doUnsetPrimary = () => {
    if (!canUnsetPrimary) {
      return;
    }

    return updateAllocation(server.uuid, allocation.uuid, { primary: false })
      .then(() => {
        patchAllocations((item) => (item.uuid === allocation.uuid ? { ...item, isPrimary: false } : item));
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
        removePaginatedItems(
          queryClient,
          queryKeys.server(server.uuid).network.all(),
          (item: z.infer<typeof serverAllocationSchema>) => item.uuid === allocation.uuid,
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).network.all() });
        addToast(t('pages.server.network.toast.removed', {}), 'success');
        setOpenModal(null);
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
          allocation: displayAllocation,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faStar,
            label: t('common.button.setPrimary', {}),
            hidden: allocation.isPrimary,
            onClick: doSetPrimary,
            color: 'gray',
            canAccess: canUpdate,
          },
          {
            type: 'action',
            icon: faStar,
            label: t('common.button.unsetPrimary', {}),
            hidden: !allocation.isPrimary,
            disabled: !canUnsetPrimary,
            onClick: doUnsetPrimary,
            color: 'red',
            canAccess: canUpdate,
          },
          {
            type: 'action',
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
            ref={ref}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={allocation.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <td className='relative w-10 text-center'>
              {allocation.isPrimary && (
                <Tooltip label={t('common.tooltip.primary', {})}>
                  <FontAwesomeIcon icon={faStar} className='text-(--mantine-color-yellow-text) ml-3' />
                </Tooltip>
              )}
            </td>

            <TableData>
              <Code>
                <RedactedText value={allocation.ipAlias ?? allocation.ip} />
              </Code>
            </TableData>

            <TableData>
              <Code>{allocation.port}</Code>
            </TableData>

            <TableData>
              <TextArea
                rows={Math.min(3, notes.split('\n').length)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('common.table.columns.notes', {})}
                disabled={!canUpdate}
                className='min-w-32'
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
});

export default AllocationRow;
