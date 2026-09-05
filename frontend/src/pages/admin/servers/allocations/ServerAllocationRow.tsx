import { faStar, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDebouncedCallback } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import deleteServerAllocation from '@/api/admin/servers/allocations/deleteServerAllocation.ts';
import updateServerAllocation from '@/api/admin/servers/allocations/updateServerAllocation.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { formatAllocation } from '@/lib/domain/server.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerAllocationRow({
  server,
  allocation,
}: {
  server: AdminServer;
  allocation: z.infer<typeof serverAllocationSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);
  const [notes, setNotes] = useState(allocation.notes ?? '');

  const invalidateAllocations = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.allocations(server.uuid) });

  const saveNotes = useDebouncedCallback((value: string) => {
    updateServerAllocation(server.uuid, allocation.uuid, { notes: value || null })
      .then(() => {
        addToast(t('pages.admin.servers.tabs.allocations.page.toast.updated', {}), 'success');
        invalidateAllocations();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, 500);

  useEffect(() => {
    if (notes !== (allocation.notes ?? '')) {
      saveNotes(notes);
    }
  }, [notes]);

  const setPrimary = (next: boolean) => {
    updateServerAllocation(server.uuid, allocation.uuid, { primary: next })
      .then(() => {
        invalidateAllocations();
        addToast(
          t(
            next
              ? 'pages.admin.servers.tabs.allocations.page.toast.setPrimary'
              : 'pages.admin.servers.tabs.allocations.page.toast.unsetPrimary',
            {},
          ),
          'success',
        );
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const doRemove = async () => {
    await deleteServerAllocation(server.uuid, allocation.uuid)
      .then(async () => {
        await invalidateAllocations();
        await queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.allocations(server.node.uuid) });
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
            type: 'action',
            icon: faStar,
            label: t('common.button.setPrimary', {}),
            hidden: allocation.isPrimary,
            onClick: () => setPrimary(true),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faStar,
            label: t('common.button.unsetPrimary', {}),
            hidden: !allocation.isPrimary,
            onClick: () => setPrimary(false),
            color: 'red',
          },
          {
            type: 'action',
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
