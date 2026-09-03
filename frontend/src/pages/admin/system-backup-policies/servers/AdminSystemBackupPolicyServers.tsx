import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteSystemBackupPolicyServer from '@/api/admin/system-backup-policies/servers/deleteSystemBackupPolicyServer.ts';
import getSystemBackupPolicyServers from '@/api/admin/system-backup-policies/servers/getSystemBackupPolicyServers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { systemBackupPolicyServerTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyAddServerModal from './modals/SystemBackupPolicyAddServerModal.tsx';

function SystemBackupPolicyServerRow({
  server,
  added,
  systemBackupPolicy,
  canRemove,
  refetch,
}: {
  server: z.infer<typeof adminServerSchema>;
  added: Date;
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  canRemove: boolean;
  refetch: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteSystemBackupPolicyServer(systemBackupPolicy.uuid, server.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.admin.systemBackupPolicies.tabs.servers.page.toast.removed', {}), 'success');
        refetch();
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
        title={t('pages.admin.systemBackupPolicies.tabs.servers.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.systemBackupPolicies.tabs.servers.page.modal.remove.content', {
          policy: systemBackupPolicy.name,
          name: server.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: canRemove,
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.servers.contextMenu}
        registryProps={{ systemBackupPolicy, server }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <TableLink to={`/admin/servers/${server.uuid}`}>
                <Code>{server.uuidShort}</Code>
              </TableLink>
            </TableData>

            <TableData>{server.name}</TableData>

            <TableData>
              <Code>
                <TableLink to={`/admin/nodes/${server.node.uuid}`}>{server.node.name}</TableLink>
              </Code>
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={added} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}

export default function AdminSystemBackupPolicyServers({
  systemBackupPolicy,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();
  const canUpdate = useAdminCan('system-backup-policies.update');
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: systemBackupPolicyServers,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.systemBackupPolicies.servers(systemBackupPolicy.uuid),
    fetcher: (page, search) => getSystemBackupPolicyServers(systemBackupPolicy.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.systemBackupPolicies.tabs.servers.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.servers.subContainer}
      registryProps={{ systemBackupPolicy }}
      contentRight={
        canUpdate ? (
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        ) : undefined
      }
    >
      {canUpdate && (
        <SystemBackupPolicyAddServerModal
          systemBackupPolicy={systemBackupPolicy}
          refetch={refetch}
          opened={openModal === 'add'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <Table
        columns={systemBackupPolicyServerTableColumns()}
        loading={loading}
        pagination={systemBackupPolicyServers}
        onPageSelect={setPage}
        error={error}
      >
        {systemBackupPolicyServers?.data.map((systemBackupPolicyServer) => (
          <SystemBackupPolicyServerRow
            key={systemBackupPolicyServer.server.uuid}
            server={systemBackupPolicyServer.server}
            added={systemBackupPolicyServer.created}
            systemBackupPolicy={systemBackupPolicy}
            canRemove={canUpdate}
            refetch={refetch}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
