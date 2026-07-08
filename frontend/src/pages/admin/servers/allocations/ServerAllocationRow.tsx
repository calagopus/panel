import { faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
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
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { formatAllocation } from '@/lib/server.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function ServerAllocationRow({
  server,
  allocation,
}: {
  server: z.infer<typeof adminServerSchema>;
  allocation: z.infer<typeof serverAllocationSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const serverAllocations = useAdminStore((state) => state.serverAllocations);
  const setServerAllocations = useAdminStore((state) => state.setServerAllocations);
  const removeServerAllocation = useAdminStore((state) => state.removeServerAllocation);

  const [openModal, setOpenModal] = useState<'remove' | null>(null);
  const [notes, setNotes] = useState(allocation.notes ?? '');

  useEffect(() => {
    if (notes !== (allocation.notes ?? '')) {
      setDebouncedNotes(notes);
    }
  }, [notes]);

  const setDebouncedNotes = useCallback(
    debounce((notes: string) => {
      updateServerAllocation(server.uuid, allocation.uuid, {
        notes: notes || null,
      })
        .then(() => {
          addToast(t('pages.admin.servers.tabs.allocations.page.toast.updated', {}), 'success');
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
        addToast(t('pages.admin.servers.tabs.allocations.page.toast.setPrimary', {}), 'success');
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
        addToast(t('pages.admin.servers.tabs.allocations.page.toast.unsetPrimary', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doRemove = async () => {
    await deleteServerAllocation(server.uuid, allocation.uuid)
      .then(async () => {
        removeServerAllocation(allocation);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.admin.servers.allocations(server.uuid),
        });
        setOpenModal(null);
        addToast(t('pages.admin.servers.tabs.allocations.page.toast.removed', {}), 'success');
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
        title={t('pages.admin.servers.tabs.allocations.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.servers.tabs.allocations.page.modal.remove.content', {
          allocation: formatAllocation(allocation),
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faStar,
            label: t('common.button.setPrimary', {}),
            hidden: allocation.isPrimary,
            onClick: doSetPrimary,
            color: 'gray',
          },
          {
            icon: faStar,
            label: t('common.button.unsetPrimary', {}),
            hidden: !allocation.isPrimary,
            onClick: doUnsetPrimary,
            color: 'red',
          },
          {
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.allocations.contextMenu}
        registryProps={{ server, allocation }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData className='relative w-10 text-center'>
              {allocation.isPrimary && (
                <Tooltip label={t('common.tooltip.primary', {})}>
                  <FontAwesomeIcon icon={faStar} className='text-yellow-500' />
                </Tooltip>
              )}
            </TableData>

            <TableData>
              <Code>{allocation.ip}</Code>
            </TableData>

            <TableData>
              <Code>{allocation.ipAlias ?? t('common.na', {})}</Code>
            </TableData>

            <TableData>
              <Code>{allocation.port}</Code>
            </TableData>

            <TableData>
              <TextArea
                rows={Math.min(3, notes.split('\n').length)}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('pages.admin.servers.tabs.allocations.page.form.notesPlaceholder', {})}
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
