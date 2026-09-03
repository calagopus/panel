import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import deleteNodeDatabaseHost from '@/api/admin/nodes/database-hosts/deleteNodeDatabaseHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode, AdminNodeDatabaseHost } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeDatabaseHostRow({
  node,
  databaseHost,
}: {
  node: AdminNode;
  databaseHost: AdminNodeDatabaseHost;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteNodeDatabaseHost(node.uuid, databaseHost.databaseHost.uuid)
      .then(() => {
        setOpenModal(null);
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.databaseHosts(node.uuid) });
        addToast(t('pages.admin.nodes.tabs.databaseHosts.page.toast.deleted', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nodes.tabs.databaseHosts.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.nodes.tabs.databaseHosts.page.modal.delete.content', {
          name: databaseHost.databaseHost.name,
          node: node.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.databaseHosts.contextMenu}
        registryProps={{ node, databaseHost }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <TableLink to={`/admin/database-hosts/${databaseHost.databaseHost.uuid}`}>
                <Code>{databaseHost.databaseHost.uuid}</Code>
              </TableLink>
            </TableData>
            <TableData>{databaseHost.databaseHost.name}</TableData>
            <TableData>{databaseTypeLabelMapping[databaseHost.databaseHost.type]}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={databaseHost.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
