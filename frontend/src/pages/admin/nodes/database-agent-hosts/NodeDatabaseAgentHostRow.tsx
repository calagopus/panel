import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import deleteNodeDatabaseAgentHost from '@/api/admin/nodes/database-agent-hosts/deleteNodeDatabaseAgentHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode, AdminNodeDatabaseAgentHost } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeDatabaseAgentHostRow({
  node,
  databaseAgentHost,
}: {
  node: AdminNode;
  databaseAgentHost: AdminNodeDatabaseAgentHost;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteNodeDatabaseAgentHost(node.uuid, databaseAgentHost.databaseAgentHost.uuid)
      .then(() => {
        setOpenModal(null);
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.databaseAgentHosts(node.uuid) });
        addToast(t('pages.admin.nodes.tabs.databaseAgentHosts.page.toast.deleted', {}), 'success');
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
        title={t('pages.admin.nodes.tabs.databaseAgentHosts.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.nodes.tabs.databaseAgentHosts.page.modal.delete.content', {
          name: databaseAgentHost.databaseAgentHost.name,
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
        registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.databaseAgentHosts.contextMenu}
        registryProps={{ node, databaseAgentHost }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <TableLink to={`/admin/database-agent-hosts/${databaseAgentHost.databaseAgentHost.uuid}`}>
                <Code>{databaseAgentHost.databaseAgentHost.uuid}</Code>
              </TableLink>
            </TableData>
            <TableData>{databaseAgentHost.databaseAgentHost.name}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={databaseAgentHost.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
