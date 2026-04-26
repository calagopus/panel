import { faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import debounce from 'debounce';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import deleteServerAllocation from '@/api/admin/servers/allocations/deleteServerAllocation.ts';
import updateServerAllocation from '@/api/admin/servers/allocations/updateServerAllocation.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { formatAllocation } from '@/lib/server.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function ServerAllocationRow({
  server,
  allocation,
}: {
  server: z.infer<typeof adminServerSchema>;
  allocation: z.infer<typeof serverAllocationSchema>;
}) {
  const { addToast } = useToast();
  const { serverAllocations, setServerAllocations, removeServerAllocation } = useAdminStore();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);
  const [notes, setNotes] = useState(allocation.notes ?? '');

  useEffect(() => {
    if (notes !== (allocation.notes ?? '')) {
      setDebouncedNotes(notes);
    }
  }, [notes]);

  const setDebouncedNotes = useCallback(
    debounce((notes: string) => {
      updateServerAllocation(server.uuid, allocation.uuid, { notes: notes || null })
        .then(() => {
          addToast('Allocation updated.', 'success');
          allocation.notes = notes;
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        });
    }, 500),
    [],
  );

  const doSetPrimary = () => {
    updateServerAllocation(server.uuid, allocation.uuid, { primary: true })
      .then(() => {
        setServerAllocations({
          ...serverAllocations,
          data: serverAllocations.data.map((a) => ({
            ...a,
            isPrimary: a.uuid === allocation.uuid,
          })),
        });
        addToast('Allocation set as primary.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doUnsetPrimary = () => {
    updateServerAllocation(server.uuid, allocation.uuid, { primary: false })
      .then(() => {
        setServerAllocations({
          ...serverAllocations,
          data: serverAllocations.data.map((a) => ({
            ...a,
            isPrimary: false,
          })),
        });
        addToast('Allocation unset as primary.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doRemove = async () => {
    await deleteServerAllocation(server.uuid, allocation.uuid)
      .then(() => {
        removeServerAllocation(allocation);
        addToast('Allocation removed.', 'success');
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
        title='Confirm Allocation Removal'
        confirm='Remove'
        onConfirmed={doRemove}
      >
        Are you sure you want to remove
        <Code>{formatAllocation(allocation)}</Code>?
      </ConfirmationModal>

      <ContextMenu
        items={[
          { icon: faStar, label: 'Set Primary', hidden: allocation.isPrimary, onClick: doSetPrimary, color: 'gray' },
          {
            icon: faStar,
            label: 'Unset Primary',
            hidden: !allocation.isPrimary,
            onClick: doUnsetPrimary,
            color: 'red',
          },
          { icon: faTrash, label: 'Remove', onClick: () => setOpenModal('remove'), color: 'red' },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.allocations.contextMenu}
        registryProps={{ server, allocation }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <TableData className='relative w-10 text-center'>
              {allocation.isPrimary && (
                <Tooltip label='Primary'>
                  <FontAwesomeIcon icon={faStar} className='text-yellow-500' />
                </Tooltip>
              )}
            </TableData>

            <TableData>
              <Code>{allocation.ip}</Code>
            </TableData>

            <TableData>
              <Code>{allocation.ipAlias ?? 'N/A'}</Code>
            </TableData>

            <TableData>
              <Code>{allocation.port}</Code>
            </TableData>

            <TableData>
              <TextArea
                rows={Math.min(3, notes.split('\n').length)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='Notes'
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
